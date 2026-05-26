const URL_RE = /https?:\/\/[^\s<>"')]+/g;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const found = text.match(URL_RE) ?? [];
  return Array.from(new Set(found.map((u) => u.replace(/[.,;:!?)]+$/, ""))));
}
