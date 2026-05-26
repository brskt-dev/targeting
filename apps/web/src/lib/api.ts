import type {
  ContactCandidate,
  Conversation,
  LeadList,
  Message,
  PlatformConnection,
  PlatformKind,
  ScanDepth,
  ScanRun,
  AgentLog,
} from "@targeting/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  // Só anexa Content-Type quando há body — Fastify rejeita POSTs sem body
  // que declaram application/json (FST_ERR_CTP_EMPTY_JSON_BODY).
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (init?.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.headers.get("content-type")?.includes("text/csv")) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

export const api = {
  url: API_URL,

  listConnections: () =>
    http<{ connections: PlatformConnection[] }>("/connections").then((r) => r.connections),

  createConnection: (input: {
    name: string;
    loginUrl: string;
    type?: PlatformKind;
    platformDescription?: string;
    dataLocations?: string;
    knownQuirks?: string;
  }) =>
    http<{ connection: PlatformConnection }>("/connections", {
      method: "POST",
      body: JSON.stringify({ type: input.type ?? "custom_web", ...input }),
    }).then((r) => r.connection),

  updateConnection: (id: string, input: {
    name?: string;
    loginUrl?: string;
    platformDescription?: string;
    dataLocations?: string;
    knownQuirks?: string;
  }) =>
    http<{ connection: PlatformConnection }>(`/connections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }).then((r) => r.connection),

  deleteConnection: (id: string) =>
    http<{ ok: true }>(`/connections/${id}`, { method: "DELETE" }),

  connect: (id: string) =>
    http<{ ok: true }>(`/connections/${id}/connect`, { method: "POST" }),

  markConnected: (id: string) =>
    http<{ ok: true }>(`/connections/${id}/mark-connected`, { method: "POST" }),

  openSession: (id: string) =>
    http<{ ok: true }>(`/connections/${id}/open`, { method: "POST" }),

  closeSession: (id: string) =>
    http<{ ok: true }>(`/connections/${id}/close`, { method: "POST" }),

  startScan: (id: string, body: {
    depth: ScanDepth;
    objective?: string;
    richInstructions?: string;
    useVision?: boolean;
  }) =>
    http<{ run: ScanRun }>(`/connections/${id}/scan`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.run),

  cancelRun: (runId: string) =>
    http<{ ok: true }>(`/runs/${runId}/cancel`, { method: "POST" }),

  deleteRun: (runId: string) =>
    http<{ ok: true; removed: Record<string, number> }>(`/runs/${runId}`, { method: "DELETE" }),

  listRuns: (connectionId?: string) =>
    http<{ runs: ScanRun[] }>(
      `/runs${connectionId ? `?connectionId=${connectionId}` : ""}`,
    ).then((r) => r.runs),

  getRun: (runId: string) =>
    http<{ run: ScanRun }>(`/runs/${runId}`).then((r) => r.run),

  listContacts: (filter?: { runId?: string; connectionId?: string }) => {
    const qs = new URLSearchParams();
    if (filter?.runId) qs.set("runId", filter.runId);
    if (filter?.connectionId) qs.set("connectionId", filter.connectionId);
    const tail = qs.toString();
    return http<{ contacts: ContactCandidate[] }>(`/contacts${tail ? `?${tail}` : ""}`).then(
      (r) => r.contacts,
    );
  },

  listConversations: (runId?: string) =>
    http<{ conversations: Conversation[] }>(
      `/conversations${runId ? `?runId=${runId}` : ""}`,
    ).then((r) => r.conversations),

  listMessages: (conversationId?: string) =>
    http<{ messages: Message[] }>(
      `/messages${conversationId ? `?conversationId=${conversationId}` : ""}`,
    ).then((r) => r.messages),

  listLogs: (runId: string) =>
    http<{ logs: AgentLog[] }>(`/logs?runId=${runId}`).then((r) => r.logs),

  listLeadLists: () =>
    http<{ leadLists: LeadList[] }>("/lead-lists").then((r) => r.leadLists),

  leadQuery: (body: { prompt: string; runIds?: string[]; connectionIds?: string[] }) =>
    http<{ leadList: LeadList }>("/lead-query", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.leadList),

  exportContactsUrl: (runId?: string) =>
    `${API_URL}/export/contacts.csv${runId ? `?runId=${runId}` : ""}`,
  exportLeadListUrl: (leadListId: string) =>
    `${API_URL}/export/lead-lists/${leadListId}.csv`,

  eventsUrl: (filter?: { connectionId?: string; runId?: string }) => {
    const qs = new URLSearchParams();
    if (filter?.connectionId) qs.set("connectionId", filter.connectionId);
    if (filter?.runId) qs.set("runId", filter.runId);
    const tail = qs.toString();
    return `${API_URL}/events${tail ? `?${tail}` : ""}`;
  },
};
