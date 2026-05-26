import type { ScanRun } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<ScanRun>("runs.jsonl");

export function listRuns(): ScanRun[] {
  return store.all();
}

export function listRunsByConnection(connectionId: string): ScanRun[] {
  return store.filter((r) => r.connectionId === connectionId);
}

export function getRun(id: string): ScanRun | undefined {
  return store.byId(id);
}

export function saveRun(run: ScanRun): ScanRun {
  store.update(run);
  return run;
}

export function deleteRun(id: string): void {
  store.delete(id);
}
