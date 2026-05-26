import type { FastifyInstance } from "fastify";
import type { ScanDepth, ScanRun } from "@targeting/shared";
import {
  getConnection,
  saveConnection,
  getRun,
  saveRun,
} from "@targeting/storage";
import { getConnector } from "@targeting/connectors";
import { log } from "@targeting/agent";
import { randomUUID } from "node:crypto";

const VALID_DEPTHS: ScanDepth[] = ["fast", "balanced", "deep", "brutal"];

// Mapa em memória de runs em execução. Permite cancelar com flag.
const stopFlags = new Map<string, boolean>();

export async function scanRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: {
      objective?: string;
      richInstructions?: string;
      depth?: ScanDepth;
      useVision?: boolean;
    };
  }>("/connections/:id/scan", async (req, reply) => {
    const conn = getConnection(req.params.id);
    if (!conn) return reply.status(404).send({ error: "connection not found" });

    const depth = (req.body?.depth ?? "balanced") as ScanDepth;
    if (!VALID_DEPTHS.includes(depth)) {
      return reply.status(400).send({ error: `depth inválida. Use ${VALID_DEPTHS.join(", ")}` });
    }
    const objective = req.body?.objective?.trim() || "Coletar contatos e evidências";
    const richInstructions = req.body?.richInstructions?.trim() || undefined;
    const useVision = req.body?.useVision === true;

    const now = new Date().toISOString();
    const run: ScanRun = {
      id: randomUUID(),
      connectionId: conn.id,
      platform: conn.type,
      objective,
      richInstructions,
      depth,
      useVision,
      status: "running",
      startedAt: now,
    };
    saveRun(run);
    stopFlags.set(run.id, false);

    log({ runId: run.id, connectionId: conn.id }, "info", "scan_started",
      `Disparando scan ${conn.type} depth=${depth}`);

    // executa em background
    (async () => {
      try {
        const connector = getConnector(conn.type);
        await connector.ensureLogin({
          connection: conn,
          shouldStop: () => stopFlags.get(run.id) === true,
        });
        if (stopFlags.get(run.id)) {
          saveRun({ ...getRun(run.id)!, status: "cancelled", finishedAt: new Date().toISOString() });
          return;
        }
        await connector.runScan({
          connection: conn,
          run,
          depth,
          shouldStop: () => stopFlags.get(run.id) === true,
        });
        const final = getRun(run.id)!;
        saveRun({
          ...final,
          status: stopFlags.get(run.id) ? "cancelled" : "completed",
          finishedAt: new Date().toISOString(),
        });
        saveConnection({ ...conn, status: "connected" });
      } catch (err) {
        const current = getRun(run.id) ?? run;
        saveRun({
          ...current,
          status: "failed",
          finishedAt: new Date().toISOString(),
        });
        log({ runId: run.id, connectionId: conn.id }, "error", "run_failed",
          `Scan falhou: ${(err as Error).message}`);
      } finally {
        stopFlags.delete(run.id);
      }
    })();

    return reply.status(202).send({ run });
  });

  app.post<{ Params: { id: string } }>("/runs/:id/cancel", async (req, reply) => {
    const r = getRun(req.params.id);
    if (!r) return reply.status(404).send({ error: "run not found" });
    stopFlags.set(r.id, true);
    log({ runId: r.id, connectionId: r.connectionId }, "info", "run_paused",
      "Cancelamento solicitado.");
    return { ok: true };
  });
}
