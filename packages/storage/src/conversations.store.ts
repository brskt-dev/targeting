import type { Conversation } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<Conversation>("conversations.jsonl");

export function listConversations(): Conversation[] {
  return store.all();
}

export function listConversationsByRun(runId: string): Conversation[] {
  return store.filter((c) => c.runId === runId);
}

export function getConversation(id: string): Conversation | undefined {
  return store.byId(id);
}

export function saveConversation(c: Conversation): Conversation {
  store.update({ ...c, updatedAt: new Date().toISOString() });
  return c;
}

export function deleteConversationsByRun(runId: string): number {
  return store.deleteWhere((c) => c.runId === runId);
}
