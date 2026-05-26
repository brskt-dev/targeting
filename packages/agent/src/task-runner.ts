import type {
  PageInteractiveElement,
  PageObservation,
  PlannedAction,
  PlatformKind,
} from "@targeting/shared";
import { BrowserAgent } from "./browser-agent";
import { observePage } from "./page-observer";
import { planNextActions } from "./action-planner";
import { evaluateAction } from "./guardrails";
import { log, type LogContext } from "./logger";

export type AgentLoopHooks = {
  // Chamado uma vez por iteração após observar a página. Connectors podem usar
  // pra extrair dados estruturados e salvar contatos incrementalmente.
  onObservation?: (obs: PageObservation, agent: BrowserAgent) => Promise<void> | void;
};

export type RunTaskOptions = {
  ctx: LogContext;
  agent: BrowserAgent;
  platform: PlatformKind;
  objective: string;
  // Contexto rico propagado ao planner (system prompt).
  richInstructions?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
  // Se true, captura screenshot da página atual e envia ao LLM junto da observação.
  useVision?: boolean;
  // Teto de SEGURANÇA (não é o critério principal de parada). Evita loop infinito
  // queimando tokens caso o agente nunca decida parar. A run normalmente termina
  // quando o agente emite "stop", quando ocorre erro, ou por cancelamento no dash.
  safetyCeiling?: number;
  shouldStop?: () => boolean;
  hooks?: AgentLoopHooks;
};

// Quantas observações idênticas consecutivas até abortar como ÚLTIMO recurso.
// A run roda até auto-concluir (stop), erro, ou cancelamento. A estagnação só
// força parada se o agente ficar travado MUITO tempo na mesma view.
const STAGNATION_ABORT = 12;

// Loop observe -> [hook] -> plan -> act.
// Critério de parada PRINCIPAL: o agente emite "stop" (concluiu, com sucesso ou
// desistência). Também para por: cancelamento (shouldStop), teto de segurança,
// ou estagnação extrema (último recurso).
export async function runAgentLoop(opts: RunTaskOptions): Promise<void> {
  const { ctx, agent, platform, objective } = opts;
  const safetyCeiling = opts.safetyCeiling ?? 500;
  const history: string[] = [];
  const observationSignatures: string[] = [];
  let stagnantStreak = 0;

  for (let i = 0; i < safetyCeiling; i++) {
    if (opts.shouldStop?.()) {
      log(ctx, "info", "run_paused", "loop interrompido por solicitação (cancelamento)");
      return;
    }

    const page = await agent.open();
    const observation = await observePage(page);

    const signature = pageSignature(observation);
    const isStagnant = observationSignatures.length > 0 &&
      observationSignatures.at(-1) === signature;
    observationSignatures.push(signature);
    stagnantStreak = isStagnant ? stagnantStreak + 1 : 0;

    log(ctx, "info", "page_observed",
      `${observation.url}${observation.title ? ` — ${observation.title}` : ""} (${observation.interactiveElements.length} elementos, ${observation.tables?.length ?? 0} tabelas)${isStagnant ? ` [igual à anterior x${stagnantStreak}]` : ""}`);

    if (opts.hooks?.onObservation) {
      try { await opts.hooks.onObservation(observation, agent); }
      catch (err) {
        log(ctx, "warn", "page_observed", `onObservation falhou: ${(err as Error).message}`);
      }
    }

    if (stagnantStreak >= STAGNATION_ABORT) {
      log(ctx, "warn", "run_paused",
        `página idêntica há ${stagnantStreak + 1} iterações seguidas — abortando como último recurso (agente travado).`);
      return;
    }

    // Pista escalonada pro LLM se estiver preso. Quanto mais tempo travado,
    // mais enfática a sugestão de mudar de abordagem ou parar.
    const stagnationHint = stagnantStreak > 0
      ? `ATENÇÃO: as últimas ${stagnantStreak + 1} observações foram IDÊNTICAS (${observation.url}). Suas ações não estão mudando a página.${stagnantStreak >= 4 ? " Você está claramente travado — mude completamente de abordagem (outro elemento, scroll, navegar para outra seção) OU emita 'stop' se já cumpriu o objetivo / concluiu que não há como avançar." : " Tente um id/elemento DIFERENTE, não repita a mesma ação."}`
      : undefined;

    // Vision: captura screenshot ANOTADO com os ids el-N visíveis quando
    // ativado OU em estagnação. Permite ao LLM correlacionar visualmente
    // qual el-N é qual botão na tela.
    let screenshotBase64: string | undefined;
    const shouldUseVision = opts.useVision === true || stagnantStreak >= 1;
    if (shouldUseVision) {
      try {
        screenshotBase64 = await agent.screenshotBase64({ withLabels: true, fullPage: false });
      } catch (err) {
        log(ctx, "warn", "page_observed", `falha ao capturar screenshot: ${(err as Error).message}`);
      }
    }

    log(ctx, "info", "action_planned",
      `chamando LLM planner (vision: ${screenshotBase64 ? "ON" : "off"}, history: ${history.length} entradas)`);

    const plan = await planNextActions({
      platform,
      objective,
      observation,
      richInstructions: opts.richInstructions,
      platformDescription: opts.platformDescription,
      dataLocations: opts.dataLocations,
      knownQuirks: opts.knownQuirks,
      screenshotBase64,
      history: stagnationHint ? [...history, stagnationHint] : history,
    });
    log(ctx, "info", "action_planned",
      `${plan.actions.length} ações: ${plan.actions.map(actionLabel).join(", ")} — ${plan.reasoning.slice(0, 200)}`);

    const elementMap = new Map(observation.interactiveElements.map((e) => [e.id, e] as const));

    let actionsExecuted = 0;
    for (const planned of plan.actions) {
      if (opts.shouldStop?.()) return;

      // Resolve refs el-N -> selector real, e tolera LLM mandando texto/aria por engano.
      const action = resolveActionRefs(planned, elementMap);

      const guard = evaluateAction(action);
      if (!guard.allowed) {
        log(ctx, "warn", "unsafe_action_blocked", guard.reason ?? "bloqueado", { action });
        continue;
      }

      // Stop só vale se for a única ação do plano OU se nada navegacional foi
      // executado antes — caso contrário o LLM decidiu parar baseado em info
      // velha, sem ter observado o resultado das ações anteriores. Ignoramos.
      if (action.kind === "stop") {
        if (actionsExecuted === 0) {
          log(ctx, "info", "run_completed", `agent decidiu parar: ${action.reason}`);
          return;
        }
        log(ctx, "warn", "page_observed",
          `'stop' ignorado: veio depois de ${actionsExecuted} ação(ões) sem nova observação. Vamos re-observar primeiro.`);
        break;
      }

      // Snapshot do elemento (texto/aria) pra usar como fallback caso o
      // data-targeting-id tenha sido invalidado por re-render da SPA.
      const snapshot = findOriginalSnapshot(planned, elementMap);

      try {
        await executeAction(agent, action, snapshot);
        log(ctx, "info", "action_executed", actionLabel(action));
        history.push(actionLabel(action));
        actionsExecuted++;
      } catch (err) {
        log(ctx, "warn", "page_observed",
          `falha ao executar ${actionLabel(action)}: ${(err as Error).message}`);
        history.push(`FALHOU: ${actionLabel(action)} (${(err as Error).message.slice(0, 80)})`);
      }

      // Após uma ação navegacional, quebra o plano para re-observar.
      // Motivo: o próximo click/fillInput depende do estado da página DEPOIS
      // desta ação (ex: botão "Buscar" só aparece após mudar filtro).
      // O LLM não sabe quais ids existirão na nova observação, então só vale
      // re-observar e replanejar.
      if (isNavigational(action.kind)) {
        break;
      }
    }
  }
  log(ctx, "warn", "run_completed",
    `teto de segurança (${safetyCeiling} iterações) atingido sem o agente emitir stop — encerrando.`);
}

async function executeAction(
  agent: BrowserAgent,
  action: PlannedAction,
  snapshot?: PageInteractiveElement,
): Promise<void> {
  const fallback = snapshot
    ? { text: snapshot.text, ariaLabel: snapshot.ariaLabel }
    : undefined;
  switch (action.kind) {
    case "navigate":
      await agent.navigate(action.url);
      return;
    case "click":
      await agent.clickByHint(action.selectorHint, fallback);
      // pequena espera para SPA reagir
      await agent.wait(600);
      return;
    case "fillInput":
      await agent.fillInput(action.selectorHint, action.value);
      await agent.wait(800);
      return;
    case "scroll":
      await agent.scroll(action.direction, action.amount);
      return;
    case "goBack":
      await agent.goBack();
      return;
    case "wait":
      await agent.wait(Math.min(action.ms, 5000));
      return;
    case "readText":
    case "extractLinks":
      // são no-op de fato — vêm na próxima observação. Não logamos como executed
      // pra não inflar o histórico. Marcamos como cumprida.
      return;
    case "openInNewTab":
      await agent.navigate(action.url);
      return;
    case "closeTab":
      return;
    case "stop":
      return;
  }
}

function actionLabel(a: PlannedAction): string {
  switch (a.kind) {
    case "navigate": return `navigate(${a.url})`;
    case "click": return `click(${a.selectorHint})`;
    case "fillInput": return `fillInput(${a.selectorHint} ← "${a.value}")`;
    case "scroll": return `scroll(${a.direction}${a.amount ? ` ${a.amount}` : ""})`;
    case "goBack": return `goBack`;
    case "wait": return `wait(${a.ms}ms)`;
    case "readText": return `readText`;
    case "extractLinks": return `extractLinks`;
    case "openInNewTab": return `openInNewTab(${a.url})`;
    case "closeTab": return `closeTab`;
    case "stop": return `stop(${a.reason})`;
  }
}

function isNavigational(kind: PlannedAction["kind"]): boolean {
  return kind === "click" || kind === "navigate" || kind === "fillInput" ||
    kind === "goBack" || kind === "openInNewTab";
}

// Devolve o snapshot do elemento referenciado pela ação ANTES da resolução
// para que o caller tenha acesso a text/aria do snapshot original (útil para
// fallback de click quando o data-targeting-id sumiu).
function findOriginalSnapshot(
  action: PlannedAction,
  elementMap: Map<string, PageInteractiveElement>,
): PageInteractiveElement | undefined {
  if (action.kind !== "click" && action.kind !== "fillInput") return undefined;
  const hint = action.selectorHint;
  if (/^el-\d+$/i.test(hint)) {
    return elementMap.get(hint.toLowerCase());
  }
  // LLM mandou texto/aria — tenta achar o elemento equivalente
  const lower = hint.toLowerCase().trim();
  for (const el of elementMap.values()) {
    if (el.text?.toLowerCase() === lower || el.ariaLabel?.toLowerCase() === lower) {
      return el;
    }
  }
  return undefined;
}

// LLM SEMPRE deve mandar selectorHint como id (ex: "el-5"), mas tolera variações.
// Tenta: id direto -> match por text exato -> match por ariaLabel exato.
function resolveActionRefs(
  action: PlannedAction,
  elementMap: Map<string, PageInteractiveElement>,
): PlannedAction {
  if (action.kind !== "click" && action.kind !== "fillInput") return action;
  const hint = action.selectorHint;

  // 1) Referência por id (caminho preferido)
  if (/^el-\d+$/i.test(hint)) {
    const el = elementMap.get(hint.toLowerCase());
    if (el?.selectorHint) {
      return { ...action, selectorHint: el.selectorHint };
    }
  }

  // 2) LLM mandou text/ariaLabel? Tenta casar.
  const lowerHint = hint.toLowerCase().trim();
  for (const el of elementMap.values()) {
    const textMatch = el.text && el.text.toLowerCase() === lowerHint;
    const ariaMatch = el.ariaLabel && el.ariaLabel.toLowerCase() === lowerHint;
    if ((textMatch || ariaMatch) && el.selectorHint) {
      return { ...action, selectorHint: el.selectorHint };
    }
  }

  // 3) Match parcial em text/aria (útil quando LLM trunca)
  for (const el of elementMap.values()) {
    if (el.text && el.text.toLowerCase().includes(lowerHint) && el.selectorHint) {
      return { ...action, selectorHint: el.selectorHint };
    }
  }

  return action;
}

// Assinatura compacta da página: URL + título + comprimento + primeiros caracteres
// do texto + contagem de elementos. Suficiente pra detectar "essa view não mudou".
function pageSignature(obs: PageObservation): string {
  return [
    obs.url,
    obs.title ?? "",
    String(obs.visibleText.length),
    obs.visibleText.slice(0, 200),
    String(obs.interactiveElements.length),
    String(obs.tables?.length ?? 0),
  ].join("|");
}
