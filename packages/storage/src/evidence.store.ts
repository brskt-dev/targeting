import type { Evidence } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

type EvidenceRecord = Evidence & { contactCandidateId?: string; runId?: string };

const store = new JsonlStore<EvidenceRecord>("evidence.jsonl");

export function listEvidence(): EvidenceRecord[] {
  return store.all();
}

export function listEvidenceByRun(runId: string): EvidenceRecord[] {
  return store.filter((e) => e.runId === runId);
}

export function saveEvidence(e: EvidenceRecord): EvidenceRecord {
  store.update(e);
  return e;
}

export function deleteEvidenceByRun(runId: string): number {
  return store.deleteWhere((e) => e.runId === runId);
}
