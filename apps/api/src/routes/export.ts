import type { FastifyInstance } from "fastify";
import type { ContactCandidate, LeadList } from "@targeting/shared";
import {
  getLeadList,
  listContacts,
  listContactsByRun,
} from "@targeting/storage";

export async function exportRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { runId?: string } }>("/export/contacts.csv", async (req, reply) => {
    const contacts = req.query.runId ? listContactsByRun(req.query.runId) : listContacts();
    const csv = toContactsCsv(contacts);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="contacts.csv"`);
    return csv;
  });

  app.get<{ Params: { id: string } }>("/export/lead-lists/:id.csv", async (req, reply) => {
    const list = getLeadList(req.params.id);
    if (!list) return reply.status(404).send({ error: "not found" });
    const csv = toLeadListCsv(list);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="lead-list-${list.id}.csv"`);
    return csv;
  });
}

function toContactsCsv(contacts: ContactCandidate[]): string {
  const headers = [
    "id",
    "platform",
    "displayName",
    "username",
    "phone",
    "emails",
    "profileUrl",
    "website",
    "extractedFrom",
    "firstSeenAt",
    "lastSeenAt",
    "evidence",
    "sourceUrls",
  ];
  const rows = contacts.map((c) =>
    [
      c.id,
      c.platform,
      c.displayName ?? "",
      c.username ?? "",
      c.phone ?? "",
      (c.emails ?? []).join(";"),
      c.profileUrl ?? "",
      c.website ?? "",
      c.extractedFrom,
      c.firstSeenAt ?? "",
      c.lastSeenAt ?? "",
      c.evidence.map((e) => `${e.type}${e.value ? `:${e.value}` : ""}`).join("|"),
      (c.sourceUrls ?? []).join(";"),
    ].map(csvField),
  );
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function toLeadListCsv(list: LeadList): string {
  const headers = [
    "leadListId",
    "leadListTitle",
    "prompt",
    "displayName",
    "username",
    "phone",
    "emails",
    "profileUrl",
    "website",
    "platform",
    "extractedFrom",
    "evidenceSummary",
    "lastSeenAt",
    "sourceUrl",
    "notes",
  ];
  const rows = list.candidates.map((c) =>
    [
      list.id,
      list.title,
      list.prompt,
      c.displayName ?? "",
      c.username ?? "",
      c.phone ?? "",
      (c.emails ?? []).join(";"),
      c.profileUrl ?? "",
      c.website ?? "",
      c.platform,
      c.extractedFrom,
      c.evidence.map((e) => e.type).join("|"),
      c.lastSeenAt ?? "",
      (c.sourceUrls ?? [])[0] ?? "",
      list.reasoningSummary ?? "",
    ].map(csvField),
  );
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function csvField(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
