import type { AgentLog } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<AgentLog>("agent-logs.jsonl");

export function listLogs(): AgentLog[] {
  return store.all();
}

export function listLogsByRun(runId: string): AgentLog[] {
  return store.filter((l) => l.runId === runId);
}

export function saveLog(log: AgentLog): AgentLog {
  store.append(log);
  return log;
}

export function deleteLogsByRun(runId: string): number {
  return store.deleteWhere((l) => l.runId === runId);
}
