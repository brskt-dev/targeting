import type { FastifyInstance } from "fastify";
import {
  listRuns,
  listRunsByConnection,
  getRun,
  deleteRun,
  deleteContactsByRun,
  deleteEvidenceByRun,
  deleteLogsByRun,
  deleteConversationsByRun,
} from "@targeting/storage";

export async function runsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { connectionId?: string } }>("/runs", async (req) => {
    const cid = req.query.connectionId;
    if (cid) return { runs: listRunsByConnection(cid) };
    return { runs: listRuns() };
  });

  app.get<{ Params: { id: string } }>("/runs/:id", async (req, reply) => {
    const r = getRun(req.params.id);
    if (!r) return reply.status(404).send({ error: "not found" });
    return { run: r };
  });

  // Exclui uma run e TUDO relacionado a ela: contatos, evidências, conversas, logs.
  app.delete<{ Params: { id: string } }>("/runs/:id", async (req, reply) => {
    const r = getRun(req.params.id);
    if (!r) return reply.status(404).send({ error: "not found" });
    if (r.status === "running") {
      return reply.status(409).send({ error: "run em andamento — cancele antes de excluir" });
    }
    const removed = {
      contacts: deleteContactsByRun(r.id),
      evidence: deleteEvidenceByRun(r.id),
      conversations: deleteConversationsByRun(r.id),
      logs: deleteLogsByRun(r.id),
    };
    deleteRun(r.id);
    return { ok: true, removed };
  });
}
