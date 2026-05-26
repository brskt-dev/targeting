// Detecta datas em formato BR comum: dd/mm, dd/mm/yyyy, "hoje", "ontem", "há X dias".
const DATE_RE = /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g;
const RELATIVE_RE = /\b(hoje|ontem|anteontem|h[áa]\s+\d+\s+(?:min(?:uto)?s?|h(?:ora)?s?|dias?|semanas?|meses?|anos?))\b/gi;

export type ExtractedDate = {
  raw: string;
  iso?: string;
};

export function extractDates(text: string, now: Date = new Date()): ExtractedDate[] {
  if (!text) return [];
  const out: ExtractedDate[] = [];

  const direct = text.match(DATE_RE) ?? [];
  for (const raw of direct) {
    const iso = tryParseDate(raw, now);
    out.push({ raw, iso });
  }

  const rel = text.match(RELATIVE_RE) ?? [];
  for (const raw of rel) {
    const iso = tryParseRelative(raw, now);
    out.push({ raw, iso });
  }

  return out;
}

function tryParseDate(raw: string, now: Date): string | undefined {
  const parts = raw.split("/").map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some((p) => Number.isNaN(p))) return undefined;
  const [d, m, y] = parts;
  const year = y !== undefined ? (y < 100 ? 2000 + y : y) : now.getFullYear();
  const dt = new Date(Date.UTC(year, m - 1, d));
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

function tryParseRelative(raw: string, now: Date): string | undefined {
  const r = raw.toLowerCase().trim();
  const dt = new Date(now.getTime());
  if (r === "hoje") return dt.toISOString();
  if (r === "ontem") { dt.setDate(dt.getDate() - 1); return dt.toISOString(); }
  if (r === "anteontem") { dt.setDate(dt.getDate() - 2); return dt.toISOString(); }
  const m = r.match(/h[áa]\s+(\d+)\s+(min(?:uto)?s?|h(?:ora)?s?|dias?|semanas?|meses?|anos?)/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  if (unit.startsWith("min")) dt.setMinutes(dt.getMinutes() - n);
  else if (unit.startsWith("h")) dt.setHours(dt.getHours() - n);
  else if (unit.startsWith("dia")) dt.setDate(dt.getDate() - n);
  else if (unit.startsWith("semana")) dt.setDate(dt.getDate() - 7 * n);
  else if (unit.startsWith("mes") || unit.startsWith("mês")) dt.setMonth(dt.getMonth() - n);
  else if (unit.startsWith("ano")) dt.setFullYear(dt.getFullYear() - n);
  return dt.toISOString();
}
