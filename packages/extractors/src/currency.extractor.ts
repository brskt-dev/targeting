const BRL_RE = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g;
const USD_RE = /(?:US\$|\$)\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g;

export type ExtractedCurrency = {
  raw: string;
  currency: "BRL" | "USD";
};

export function extractCurrencies(text: string): ExtractedCurrency[] {
  if (!text) return [];
  const out: ExtractedCurrency[] = [];
  for (const raw of text.match(BRL_RE) ?? []) out.push({ raw, currency: "BRL" });
  for (const raw of text.match(USD_RE) ?? []) out.push({ raw, currency: "USD" });
  return out;
}
