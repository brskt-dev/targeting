import type { Lead } from "@targeting/shared";

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^\w\s]/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  // Keep tokens longer than 2 chars to skip abbreviations like "sp", "rj", "mg"
  return normalizeStr(s)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Returns a score modifier (-20 to +20) reflecting how well the lead's
 * known text matches the requested location.
 *
 * Uses strict token equality — "americana" does NOT match "americas",
 * "american", or "latin america". Tokens must appear verbatim.
 *
 * Never hard-rejects: many profiles don't expose a location at all.
 */
export function scoreLocationMatch(lead: Lead, location: string | undefined): number {
  if (!location?.trim()) return 0;

  const locTokens = tokenize(location);
  if (locTokens.length === 0) return 0;

  // Build a token set from all textual fields of the lead
  const leadText = [lead.name, lead.description, lead.location]
    .filter(Boolean)
    .join(" ");

  const leadTokenSet = new Set(tokenize(leadText));

  const matchedCount = locTokens.filter((lt) => leadTokenSet.has(lt)).length;

  if (matchedCount === 0) {
    // No location evidence: small penalty (profiles often omit location)
    return -5;
  }

  if (matchedCount === locTokens.length) {
    // Full match
    return 20;
  }

  // Partial match (e.g. "americana" found but "sp" not)
  return 8;
}
