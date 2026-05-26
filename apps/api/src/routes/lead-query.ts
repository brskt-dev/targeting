import type { FastifyInstance } from "fastify";
import type { LeadList } from "@targeting/shared";
import {
  listContacts,
  listContactsByConnection,
  listContactsByRun,
  listConversations,
  listConversationsByRun,
  listMessages,
  listMessagesByConversation,
  saveLeadList,
} from "@targeting/storage";
import { getLlmProvider } from "@targeting/agent";
import { randomUUID } from "node:crypto";

export async function leadQueryRoutes(app: FastifyInstance) {
  app.post<{
    Body: {
      prompt: string;
      runIds?: string[];
      connectionIds?: string[];
    };
  }>("/lead-query", async (req, reply) => {
    const { prompt, runIds, connectionIds } = req.body ?? ({} as { prompt: string });
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return reply.status(400).send({ error: "prompt obrigatório" });
    }

    let candidates = listContacts();
    if (runIds && runIds.length > 0) {
      candidates = runIds.flatMap((rid) => listContactsByRun(rid));
    } else if (connectionIds && connectionIds.length > 0) {
      candidates = connectionIds.flatMap((cid) => listContactsByConnection(cid));
    }

    let conversations = listConversations();
    if (runIds && runIds.length > 0) {
      conversations = runIds.flatMap((rid) => listConversationsByRun(rid));
    }

    // Pega apenas mensagens das conversations selecionadas pra reduzir custo
    const messages = conversations.length > 0
      ? conversations.flatMap((c) => listMessagesByConversation(c.id))
      : listMessages();

    const llm = getLlmProvider();
    const draft = await llm.answerLeadQuery({
      prompt: prompt.trim(),
      candidates,
      conversations,
      messages,
    });

    const byId = new Map(candidates.map((c) => [c.id, c]));
    const selected = draft.selectedCandidateIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c);

    const leadList: LeadList = {
      id: randomUUID(),
      title: draft.title || `Lista — ${prompt.slice(0, 60)}`,
      prompt: prompt.trim(),
      sourceRunIds: runIds ?? [],
      candidates: selected,
      reasoningSummary: draft.reasoningSummary,
      warnings: draft.warnings,
      createdAt: new Date().toISOString(),
    };
    saveLeadList(leadList);
    return { leadList };
  });
}
