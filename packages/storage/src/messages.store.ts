import type { Message } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<Message>("messages.jsonl");

export function listMessages(): Message[] {
  return store.all();
}

export function listMessagesByConversation(conversationId: string): Message[] {
  return store.filter((m) => m.conversationId === conversationId);
}

export function saveMessage(m: Message): Message {
  store.update(m);
  return m;
}
