import type {
  ContactCandidate,
  Evidence,
  PageObservation,
} from "@targeting/shared";
import {
  getOrCreateAgent,
  log,
  runAgentLoop,
  getLlmProvider,
} from "@targeting/agent";
import {
  saveContact,
  saveEvidence,
  saveRun,
} from "@targeting/storage";
import {
  extractEmails,
  extractPhones,
  extractUrls,
} from "@targeting/extractors";
import { randomUUID } from "node:crypto";
import type { Connector, ConnectorRunArgs } from "../types";
import { ceilingFor } from "../types";

export const customWebConnector: Connector = {
  type: "custom_web",
  startUrl: "about:blank",

  async ensureLogin({ connection, shouldStop }) {
    const url = connection.loginUrl;
    if (!url) {
      throw new Error("Conexão custom_web sem loginUrl. Defina a URL antes de conectar.");
    }
    const agent = getOrCreateAgent({
      connectionId: connection.id,
      startUrl: url,
      headless: false,
    });
    const page = await agent.open();

    log({ connectionId: connection.id }, "info", "login_required",
      `Faça login em ${url}. Aguardando login... (você também pode clicar "Já estou logado" no dashboard)`);

    const deadline = Date.now() + 10 * 60_000;
    const initialUrl = page.url();
    let stableTicks = 0;
    let lastUrl = initialUrl;
    while (Date.now() < deadline) {
      if (shouldStop?.()) return;
      const u = page.url();
      if (u === lastUrl) stableTicks++; else { stableTicks = 0; lastUrl = u; }
      const hasPasswordField = await page.locator("input[type='password']:visible").count().catch(() => 0);
      const urlChanged = u !== initialUrl;
      const urlNotLoginish = !/login|sign-?in|signin/i.test(u);
      if (hasPasswordField === 0 && (urlChanged || stableTicks >= 5)) {
        if (urlNotLoginish) break;
        if (stableTicks >= 5) break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    log({ connectionId: connection.id }, "info", "login_detected", "Sessão custom_web ativa.");
  },

  async runScan(args: ConnectorRunArgs) {
    const { connection, run, depth, shouldStop } = args;
    const ctx = { runId: run.id, connectionId: connection.id };

    const agent = getOrCreateAgent({
      connectionId: connection.id,
      startUrl: connection.loginUrl ?? "about:blank",
      headless: false,
    });

    const metrics = {
      pagesObserved: 0,
      contactsFound: 0,
      evidenceAdded: 0,
      tablesFound: 0,
    };

    // Teto de segurança alto baseado em depth — NÃO é o critério de parada.
    // A run roda até o agente emitir "stop", erro, ou cancelamento pelo dash.
    const { safetyCeiling } = ceilingFor(depth);
    log(ctx, "info", "scan_started",
      `Iniciando varredura custom_web (teto de segurança=${safetyCeiling} iter, useVision=${run.useVision ?? false}). A run para quando o agente concluir o objetivo ou por cancelamento.`);

    // Cache para não re-extrair a mesma view repetidas vezes (assinatura por conteúdo)
    const extractedSignatures = new Set<string>();

    const userObjective = (run.objective ?? "").trim();
    log(ctx, "info", "scan_started",
      `Objetivo do usuário: "${userObjective || "(não informado)"}"`);

    await runAgentLoop({
      ctx,
      agent,
      platform: "custom_web",
      objective: userObjective || "Explorar o sistema e extrair listas relevantes.",
      // Contexto rico fornecido pelo usuário — chega no system prompt do LLM
      richInstructions: run.richInstructions,
      platformDescription: connection.platformDescription,
      dataLocations: connection.dataLocations,
      knownQuirks: connection.knownQuirks,
      useVision: run.useVision ?? false,
      safetyCeiling,
      shouldStop,
      hooks: {
        onObservation: async (obs) => {
          metrics.pagesObserved++;

          const sig = quickSig(obs);
          if (extractedSignatures.has(sig)) return;

          // Só vale o esforço de extrair se a view tem tabela ou muito conteúdo
          const hasInterestingContent =
            (obs.tables?.length ?? 0) > 0 ||
            obs.visibleText.length > 800 ||
            obs.interactiveElements.length > 15;

          if (!hasInterestingContent) return;

          extractedSignatures.add(sig);
          if (obs.tables?.length) {
            metrics.tablesFound += obs.tables.length;
            log(ctx, "info", "custom_table_found",
              `${obs.tables.length} tabela(s) detectada(s) em ${obs.url}`);
          }

          // Quando vision está ligado, anexa screenshot fullPage (sem badges
          // de id, pra extração ficar com a imagem limpa). LLM consegue ler
          // os rows de pacientes visualmente.
          let screenshotBase64: string | undefined;
          if (run.useVision) {
            try {
              screenshotBase64 = await agent.screenshotBase64({ withLabels: false, fullPage: true });
            } catch (err) {
              log(ctx, "warn", "page_observed",
                `falha ao capturar screenshot para extração: ${(err as Error).message}`);
            }
          }

          let extracted;
          try {
            log(ctx, "info", "page_observed",
              `chamando LLM para extrair de ${obs.url} (tabelas/listas: ${obs.tables?.length ?? 0}, texto: ${obs.visibleText.length} chars, vision: ${screenshotBase64 ? "ON" : "off"})`);
            extracted = await getLlmProvider().extractStructuredData({
              observation: obs,
              platform: "custom_web",
              extractKind: "table_rows",
              screenshotBase64,
            });
          } catch (err) {
            log(ctx, "warn", "page_observed",
              `extração LLM falhou: ${(err as Error).message}`);
            return;
          }

          if (!extracted.records || extracted.records.length === 0) {
            log(ctx, "info", "page_observed",
              `LLM extraiu 0 registros de ${obs.url}`);
            return;
          }

          const newContacts = saveExtractedRecords({
            records: extracted.records,
            connectionId: connection.id,
            runId: run.id,
            sourceUrl: obs.url,
          });
          metrics.contactsFound += newContacts.added;
          metrics.evidenceAdded += newContacts.evidence;

          log(ctx, "info", "custom_record_found",
            `+${newContacts.added} novo(s), ${newContacts.merged} atualizado(s) de ${obs.url} (total contatos únicos: ${metrics.contactsFound})`);

          // persiste métricas em tempo real para o dashboard mostrar progresso
          saveRun({
            ...run,
            metrics: {
              pagesObserved: metrics.pagesObserved,
              contactsFound: metrics.contactsFound,
              evidenceAdded: metrics.evidenceAdded,
            },
          });
        },
      },
    });

    saveRun({
      ...run,
      metrics: {
        pagesObserved: metrics.pagesObserved,
        contactsFound: metrics.contactsFound,
        evidenceAdded: metrics.evidenceAdded,
      },
    });

    log(ctx, "info", "run_completed",
      `Varredura custom_web concluída: ${metrics.contactsFound} contatos, ${metrics.tablesFound} tabelas, ${metrics.pagesObserved} páginas observadas.`);
  },
};

type ExtractedRecord = {
  fields: Array<{ key: string; value: string; sourceLabel?: string; confidence?: number }>;
  raw?: Record<string, unknown>;
};

function saveExtractedRecords(args: {
  records: ExtractedRecord[];
  connectionId: string;
  runId: string;
  sourceUrl: string;
}): { added: number; merged: number; evidence: number } {
  let added = 0;
  let merged = 0;
  let evidence = 0;
  const seenInBatch = new Set<string>();

  for (const rec of args.records) {
    const fields = Object.fromEntries(
      rec.fields.map((f) => [f.key.toLowerCase().trim(), f.value]),
    );

    const displayName =
      fields["nome"] ?? fields["paciente"] ?? fields["cliente"] ?? fields["name"];
    const phoneRaw = fields["telefone"] ?? fields["phone"] ?? fields["celular"] ?? fields["whatsapp"] ?? "";
    const emailRaw = fields["email"] ?? fields["e-mail"] ?? "";
    const status = fields["status"] ?? fields["situação"] ?? fields["situacao"] ?? fields["state"];

    const phoneDigits = phoneRaw.replace(/\D/g, "");
    const nameNorm = (displayName ?? "").toLowerCase().trim();
    const batchKey = phoneDigits || nameNorm;
    if (!batchKey) continue; // sem dado mínimo
    if (seenInBatch.has(batchKey)) continue; // já apareceu nesta extração
    seenInBatch.add(batchKey);

    const contact: ContactCandidate = {
      id: randomUUID(),
      platform: "custom_web",
      sourceConnectionId: args.connectionId,
      sourceRunId: args.runId,
      kind: "person",
      displayName: displayName?.trim() || undefined,
      phone: extractPhones(phoneRaw)[0],
      emails: extractEmails(emailRaw),
      sourceUrls: [args.sourceUrl, ...extractUrls(JSON.stringify(rec.raw ?? {}))],
      extractedFrom: "custom_table",
      rawData: rec.raw,
      evidence: [makeEv("table_row_found", "registro extraído de tabela", args.sourceUrl)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (status) contact.evidence.push(makeEv("status_found", status, args.sourceUrl));

    const result = saveContact(contact);
    for (const ev of contact.evidence) {
      saveEvidence({ ...ev, contactCandidateId: result.contact.id, runId: args.runId });
      evidence++;
    }
    if (result.merged) merged++; else added++;
  }
  return { added, merged, evidence };
}

function makeEv(type: Evidence["type"], value: string, sourceUrl: string): Evidence {
  return {
    id: randomUUID(),
    type,
    value,
    sourceUrl,
    timestamp: new Date().toISOString(),
  };
}

// Assinatura da página para evitar reprocessar a mesma view com LLM.
// Hashea o visibleText INTEIRO — datas, lista de pacientes, aba ativa,
// qualquer mudança real produz uma assinatura diferente. Antes usávamos
// só 200 chars iniciais, e o chrome do topo (sempre igual) gerava falsos
// positivos de dedup que pulavam extrações legítimas.
function quickSig(obs: PageObservation): string {
  let h = 0;
  for (let i = 0; i < obs.visibleText.length; i++) {
    h = ((h << 5) - h + obs.visibleText.charCodeAt(i)) | 0;
  }
  return `${obs.url}|${obs.title ?? ""}|h=${h}|tbl=${obs.tables?.length ?? 0}|el=${obs.interactiveElements.length}`;
}
