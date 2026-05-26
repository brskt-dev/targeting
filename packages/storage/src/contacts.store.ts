import type { ContactCandidate, Evidence } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<ContactCandidate>("contacts.jsonl");

export function listContacts(): ContactCandidate[] {
  return store.all();
}

export function listContactsByRun(runId: string): ContactCandidate[] {
  return store.filter((c) => c.sourceRunId === runId);
}

export function listContactsByConnection(connectionId: string): ContactCandidate[] {
  return store.filter((c) => c.sourceConnectionId === connectionId);
}

export function getContact(id: string): ContactCandidate | undefined {
  return store.byId(id);
}

// Chave de dedupe: telefone normalizado é o sinal mais forte; nome normalizado
// só vale como fallback quando há telefone OU nome.
function normalize(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function digits(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

// Dedup é escopado à MESMA RUN: cada run produz sua própria lista de leads.
// Dentro de uma run, dois registros do mesmo paciente (telefone/nome) viram um.
// Entre runs diferentes, contatos NÃO se misturam — runs são independentes.
function findExistingMatch(c: ContactCandidate): ContactCandidate | undefined {
  const phoneKey = digits(c.phone);
  const nameKey = normalize(c.displayName);
  if (!phoneKey && !nameKey) return undefined;
  const sameRun = store.filter((x) => x.sourceRunId === c.sourceRunId);
  for (const x of sameRun) {
    if (phoneKey && digits(x.phone) === phoneKey) return x;
  }
  // Só faz match por nome se NENHUM dos dois tem telefone (evita colidir homônimos)
  if (!phoneKey) {
    for (const x of sameRun) {
      if (!digits(x.phone) && nameKey && normalize(x.displayName) === nameKey) return x;
    }
  }
  return undefined;
}

// Salva um candidato. Se já existir um match na mesma conexão (telefone igual,
// ou nome igual quando ninguém tem telefone), faz merge de evidências e dos
// campos auxiliares em vez de criar duplicata.
export function saveContact(contact: ContactCandidate): { contact: ContactCandidate; merged: boolean } {
  const now = new Date().toISOString();
  const existing = findExistingMatch(contact);
  if (existing) {
    const evidenceKey = (e: Evidence) => `${e.type}|${e.value ?? ""}|${e.sourceUrl ?? ""}`;
    const seen = new Set(existing.evidence.map(evidenceKey));
    const newEvidence = contact.evidence.filter((e) => !seen.has(evidenceKey(e)));

    const merged: ContactCandidate = {
      ...existing,
      displayName: existing.displayName ?? contact.displayName,
      username: existing.username ?? contact.username,
      phone: existing.phone ?? contact.phone,
      emails: Array.from(new Set([...(existing.emails ?? []), ...(contact.emails ?? [])])),
      profileUrl: existing.profileUrl ?? contact.profileUrl,
      website: existing.website ?? contact.website,
      sourceUrls: Array.from(new Set([...(existing.sourceUrls ?? []), ...(contact.sourceUrls ?? [])])),
      lastSeenAt: contact.lastSeenAt ?? existing.lastSeenAt,
      evidence: [...existing.evidence, ...newEvidence],
      updatedAt: now,
    };
    store.update(merged);
    return { contact: merged, merged: true };
  }
  store.update({ ...contact, updatedAt: now });
  return { contact, merged: false };
}

export function deleteContactsByRun(runId: string): number {
  return store.deleteWhere((c) => c.sourceRunId === runId);
}

export function addEvidenceToContact(contactId: string, evidence: Evidence): ContactCandidate | undefined {
  const c = store.byId(contactId);
  if (!c) return undefined;
  const updated: ContactCandidate = {
    ...c,
    evidence: [...c.evidence, evidence],
    updatedAt: new Date().toISOString(),
  };
  store.update(updated);
  return updated;
}
