import type {
  AnswerLeadQueryInput,
  ExtractStructuredDataInput,
  ExtractedData,
  InterpretPageInput,
  LeadListDraft,
  PageInterpretation,
  PlanTaskInput,
  PlannedAction,
  TaskPlan,
} from "@targeting/shared";
import type { LlmProvider } from "../llm-provider";
import {
  ANSWER_LEAD_QUERY_SYSTEM_PROMPT,
  EXTRACT_DATA_SYSTEM_PROMPT,
  INTERPRET_PAGE_SYSTEM_PROMPT,
  planTaskSystemPrompt,
} from "../prompts";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type ChatMessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type ChatMessage = {
  role: "system" | "user";
  content: string | ChatMessageContent[];
};

type OpenAiResponse = {
  choices: Array<{ message?: { content?: string } }>;
};

async function callOpenAi(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as OpenAiResponse;
  return data.choices[0]?.message?.content ?? "{}";
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Tenta achar o array de ações em vários formatos que diferentes modelos usam:
// - { actions: [...] }
// - { plan: { actions: [...] } } / { result: {...} }
// - { actions: { "0": {...}, "1": {...} } } (objeto indexado)
// - uma ação única no topo: { kind: "click", ... }
// - array no topo
function coerceActionsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;

  // Procura uma chave "actions" em qualquer nível raso
  const candidates: unknown[] = [obj.actions, (obj.plan as Record<string, unknown> | undefined)?.actions, (obj.result as Record<string, unknown> | undefined)?.actions];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === "object") return Object.values(c as Record<string, unknown>);
  }

  // Ação única no topo?
  if (typeof obj.kind === "string" || typeof obj.action === "string" || typeof obj.type === "string") {
    return [obj];
  }
  return [];
}

// Normaliza respostas que não seguem exatamente o schema discriminado.
function normalizeActions(rawInput: unknown): PlannedAction[] {
  const arr = coerceActionsArray(rawInput);
  const out: PlannedAction[] = [];
  for (const item of arr as Array<Record<string, unknown>>) {
    if (!item || typeof item !== "object") continue;
    const kindRaw = item.kind ?? item.action ?? item.type ?? item.name;
    const kind = typeof kindRaw === "string" ? kindRaw.toLowerCase() : "";
    const reason = (item.reason as string | undefined) ?? (item.why as string | undefined) ?? "";

    switch (kind) {
      case "navigate":
      case "goto":
      case "open": {
        const url = (item.url as string | undefined) ?? (item.target as string | undefined);
        if (url) out.push({ kind: "navigate", url, reason });
        break;
      }
      case "click":
      case "tap":
      case "select": {
        const hint =
          (item.selectorhint as string | undefined) ??
          (item.selectorHint as string | undefined) ??
          (item.selector as string | undefined) ??
          (item.target as string | undefined) ??
          (item.text as string | undefined) ??
          (item.element as string | undefined);
        if (hint) out.push({ kind: "click", selectorHint: hint, reason });
        break;
      }
      case "fillinput":
      case "fill":
      case "type":
      case "input": {
        const hint =
          (item.selectorhint as string | undefined) ??
          (item.selectorHint as string | undefined) ??
          (item.selector as string | undefined) ??
          (item.target as string | undefined) ??
          (item.field as string | undefined) ??
          (item.label as string | undefined);
        const value =
          (item.value as string | undefined) ??
          (item.text as string | undefined) ??
          (item.content as string | undefined) ??
          "";
        if (hint && value !== "") out.push({ kind: "fillInput", selectorHint: hint, value, reason });
        break;
      }
      case "scroll": {
        const direction = ((item.direction as string | undefined) ?? "down").toLowerCase() === "up" ? "up" : "down";
        const amount = typeof item.amount === "number" ? item.amount : 800;
        out.push({ kind: "scroll", direction, amount, reason });
        break;
      }
      case "goback":
      case "back":
        out.push({ kind: "goBack", reason });
        break;
      case "wait":
      case "sleep": {
        const ms = typeof item.ms === "number" ? item.ms : (typeof item.duration === "number" ? item.duration : 1000);
        out.push({ kind: "wait", ms, reason });
        break;
      }
      case "readtext":
      case "read":
        out.push({ kind: "readText", reason });
        break;
      case "extractlinks":
      case "extract_links":
      case "links":
        out.push({ kind: "extractLinks", reason });
        break;
      case "openinnewtab":
      case "open_in_new_tab":
      case "newtab": {
        const url = (item.url as string | undefined) ?? (item.target as string | undefined);
        if (url) out.push({ kind: "openInNewTab", url, reason });
        break;
      }
      case "closetab":
      case "close":
        out.push({ kind: "closeTab", reason });
        break;
      case "stop":
      case "halt":
      case "end":
        out.push({ kind: "stop", reason });
        break;
    }
  }
  return out;
}

export class OpenAiLlmProvider implements LlmProvider {
  async planTask(input: PlanTaskInput): Promise<TaskPlan> {
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = planTaskSystemPrompt({
      currentDate: today,
      userObjective: input.objective,
      richInstructions: input.richInstructions,
      platformDescription: input.platformDescription,
      dataLocations: input.dataLocations,
      knownQuirks: input.knownQuirks,
    });

    const elements = input.pageObservation?.interactiveElements ?? [];
    const obsTables = input.pageObservation?.tables ?? [];
    const trimmedObs = input.pageObservation
      ? {
          url: input.pageObservation.url,
          title: input.pageObservation.title,
          visibleText: input.pageObservation.visibleText.slice(0, 3000),
          interactiveElements: elements.slice(0, 60).map((e) => ({
            id: e.id,
            role: e.role,
            text: e.text,
            ariaLabel: e.ariaLabel,
          })),
          tables: obsTables.slice(0, 4).map((t) => ({
            headers: t.headers,
            rowsCount: t.rowsPreview.length,
            sampleRows: t.rowsPreview.slice(0, 3),
          })),
        }
      : null;

    const userPayload = JSON.stringify({
      platform: input.platform,
      observation: trimmedObs,
      history: input.history?.slice(-12),
    });

    const userContent: ChatMessageContent[] = [{ type: "text", text: userPayload }];
    if (input.screenshotBase64) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${input.screenshotBase64}`,
          detail: "auto",
        },
      });
    }

    const raw = await callOpenAi([
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ]);
    const parsed = safeParse<{ actions?: unknown; reasoning?: string }>(raw, {});
    // Passa o objeto parseado inteiro — coerceActionsArray procura actions em
    // vários formatos (wrappers, objeto indexado, ação única no topo).
    const actions = normalizeActions(parsed);
    if (actions.length === 0) {
      // Surfaceia a resposta crua para diagnóstico no log do agente.
      return {
        actions: [{ kind: "stop", reason: `LLM não retornou ações válidas. Resposta crua: ${raw.slice(0, 600)}` }],
        reasoning: parsed.reasoning ?? "",
      };
    }
    return { actions, reasoning: parsed.reasoning ?? "" };
  }

  async interpretPage(input: InterpretPageInput): Promise<PageInterpretation> {
    const user = JSON.stringify({
      platform: input.platform,
      objective: input.objective,
      url: input.observation.url,
      title: input.observation.title,
      visibleText: input.observation.visibleText.slice(0, 4000),
    });
    const raw = await callOpenAi([
      { role: "system", content: INTERPRET_PAGE_SYSTEM_PROMPT },
      { role: "user", content: user },
    ]);
    return safeParse<PageInterpretation>(raw, { summary: "", hints: {} });
  }

  async extractStructuredData(input: ExtractStructuredDataInput): Promise<ExtractedData> {
    const userText = JSON.stringify({
      platform: input.platform,
      extractKind: input.extractKind,
      hints: input.hints,
      observation: {
        url: input.observation.url,
        title: input.observation.title,
        visibleText: input.observation.visibleText.slice(0, 12000),
        tables: input.observation.tables,
        links: input.observation.links.slice(0, 80),
      },
    });
    const userContent: ChatMessageContent[] = [{ type: "text", text: userText }];
    if (input.screenshotBase64) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${input.screenshotBase64}`,
          detail: "high",
        },
      });
    }
    const raw = await callOpenAi([
      { role: "system", content: EXTRACT_DATA_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);
    return safeParse<ExtractedData>(raw, { records: [] });
  }

  async answerLeadQuery(input: AnswerLeadQueryInput): Promise<LeadListDraft> {
    const user = JSON.stringify({
      prompt: input.prompt,
      candidates: input.candidates.map((c) => ({
        id: c.id,
        platform: c.platform,
        displayName: c.displayName,
        username: c.username,
        phone: c.phone,
        emails: c.emails,
        kind: c.kind,
        extractedFrom: c.extractedFrom,
        evidence: c.evidence.map((e) => ({ type: e.type, value: e.value, ts: e.timestamp })),
      })),
      conversationsCount: input.conversations?.length ?? 0,
      messagesCount: input.messages?.length ?? 0,
    });
    const raw = await callOpenAi([
      { role: "system", content: ANSWER_LEAD_QUERY_SYSTEM_PROMPT },
      { role: "user", content: user },
    ]);
    return safeParse<LeadListDraft>(raw, {
      title: `Lista — ${input.prompt.slice(0, 60)}`,
      selectedCandidateIds: [],
      reasoningSummary: "",
    });
  }
}
