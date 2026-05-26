import type { FastifyInstance } from "fastify";
import {
  listContacts,
  listContactsByRun,
  listContactsByConnection,
  listConversations,
  listConversationsByRun,
  listMessages,
  listMessagesByConversation,
  listEvidence,
  listLogsByRun,
  listLeadLists,
} from "@targeting/storage";

export async function dataRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { runId?: string; connectionId?: string } }>("/contacts", async (req) => {
    if (req.query.runId) return { contacts: listContactsByRun(req.query.runId) };
    if (req.query.connectionId) return { contacts: listContactsByConnection(req.query.connectionId) };
    return { contacts: listContacts() };
  });

  app.get<{ Querystring: { runId?: string } }>("/conversations", async (req) => {
    if (req.query.runId) return { conversations: listConversationsByRun(req.query.runId) };
    return { conversations: listConversations() };
  });

  app.get<{ Querystring: { conversationId?: string } }>("/messages", async (req) => {
    if (req.query.conversationId)
      return { messages: listMessagesByConversation(req.query.conversationId) };
    return { messages: listMessages() };
  });

  app.get("/evidence", async () => ({ evidence: listEvidence() }));

  app.get<{ Querystring: { runId: string } }>("/logs", async (req, reply) => {
    if (!req.query.runId) return reply.status(400).send({ error: "runId obrigatório" });
    return { logs: listLogsByRun(req.query.runId) };
  });

  app.get("/lead-lists", async () => ({ leadLists: listLeadLists() }));
}
