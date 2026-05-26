import "./load-env";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { OpenAiLlmProvider, setLlmProvider } from "@targeting/agent";
import { listRuns, saveRun } from "@targeting/storage";
import { connectionsRoutes } from "./routes/connections";
import { runsRoutes } from "./routes/runs";
import { scanRoutes } from "./routes/scan";
import { dataRoutes } from "./routes/data";
import { leadQueryRoutes } from "./routes/lead-query";
import { exportRoutes } from "./routes/export";
import { eventsRoutes } from "./routes/events";
import { legacySearchRoutes } from "./routes/legacy-search";

const app = Fastify({ logger: true });

// Aceita JSON body vazio em POSTs sem corpo (ex: /connect, /open, /cancel).
// Sem isso, o Fastify retorna FST_ERR_CTP_EMPTY_JSON_BODY quando o cliente
// manda Content-Type: application/json sem payload.
app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_req, body: string, done) => {
    if (!body || body.trim().length === 0) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(err as Error, undefined);
    }
  },
);

function requireOpenAiKey(): void {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim().length === 0) {
    console.error(
      [
        "",
        "❌ OPENAI_API_KEY ausente.",
        "",
        "O Targeting agora exige LLM real (sem fallback heurístico).",
        "Crie um arquivo .env na raiz do repositório com:",
        "",
        "  OPENAI_API_KEY=sk-...",
        "  OPENAI_MODEL=gpt-4o-mini   # opcional",
        "",
        "Veja .env.example para o template.",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

function reconcileStaleRuns(): void {
  // Runs com status "running" no storage só existem se um processo anterior
  // morreu sem flipar status. Quando subimos uma instância nova, nada está
  // realmente rodando — marcamos como failed para liberar a UI.
  const stale = listRuns().filter((r) => r.status === "running");
  for (const r of stale) {
    saveRun({
      ...r,
      status: "failed",
      finishedAt: new Date().toISOString(),
    });
  }
  if (stale.length > 0) {
    app.log.warn(
      { count: stale.length },
      "runs órfãs marcadas como failed (API foi reiniciada com scans em curso)",
    );
  }
}

async function main() {
  requireOpenAiKey();

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  setLlmProvider(new OpenAiLlmProvider());

  reconcileStaleRuns();

  await app.register(connectionsRoutes);
  await app.register(runsRoutes);
  await app.register(scanRoutes);
  await app.register(dataRoutes);
  await app.register(leadQueryRoutes);
  await app.register(exportRoutes);
  await app.register(eventsRoutes);
  await app.register(legacySearchRoutes);

  app.get("/health", async () => ({
    status: "ok",
    llm: "openai",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  }));

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
