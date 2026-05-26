const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function extractEmails(text: string): string[] {
  if (!text) return [];
  const found = text.match(EMAIL_RE) ?? [];
  return Array.from(new Set(found.map((e) => e.toLowerCase())));
}
