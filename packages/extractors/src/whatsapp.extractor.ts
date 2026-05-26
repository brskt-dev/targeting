import { extractPhones, normalizePhone } from "./phone.extractor";

const WA_LINK_RE = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\+?\d{8,15})/gi;

export function extractWhatsApps(text: string): string[] {
  if (!text) return [];
  const fromLinks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = WA_LINK_RE.exec(text)) !== null) {
    fromLinks.push(normalizePhone(m[1]));
  }
  const fromText = extractPhones(text);
  return Array.from(new Set([...fromLinks, ...fromText]));
}
