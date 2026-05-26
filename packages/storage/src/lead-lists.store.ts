import type { LeadList } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<LeadList>("lead-lists.jsonl");

export function listLeadLists(): LeadList[] {
  return store.all();
}

export function getLeadList(id: string): LeadList | undefined {
  return store.byId(id);
}

export function saveLeadList(list: LeadList): LeadList {
  store.update(list);
  return list;
}
