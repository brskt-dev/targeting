// Telefones BR e internacionais simples. Foco em DDD/celular brasileiros.
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;

export function extractPhones(text: string): string[] {
  if (!text) return [];
  const matches = text.match(PHONE_RE) ?? [];
  const cleaned = matches
    .map((m) => m.replace(/[^\d+]/g, ""))
    .filter((m) => m.replace(/\D/g, "").length >= 10 && m.replace(/\D/g, "").length <= 15);
  return Array.from(new Set(cleaned));
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}
