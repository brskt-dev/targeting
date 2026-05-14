import type { Lead, SearchInput } from "@targeting/shared";
import { isContactLikeResult, isKnownProfilePlatform } from "./profile-filter";
import { scoreLocationMatch } from "./location-filter";
import { scoreLeadForTargetType } from "../scorer";

function normalizeUrl(url: string): string {
  return (url || "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "")
    .trim();
}

function deduplicateLeads(leads: Lead[]): Lead[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = normalizeUrl(lead.profileUrl ?? lead.sourceUrl);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Full post-processing pipeline applied to every collected lead:
 *
 * 1. Hard-reject editorial/academic/job content (profile-filter)
 * 2. Score by targetType relevance (scorer)
 * 3. Adjust score by location match quality (location-filter)
 * 4. Bonus for known profile platform URLs
 * 5. Deduplication by normalised URL
 * 6. Filter score ≤ 5 and sort descending
 */
export function applyPostProcessing(leads: Lead[], input: SearchInput): Lead[] {
  const { targetType, location } = input;

  // Step 1 — hard reject non-contact results
  const contactOnly = leads.filter((l) => isContactLikeResult(l, targetType));

  // Step 2–4 — score
  const scored = contactOnly.map((lead) => {
    let score = scoreLeadForTargetType(lead, targetType); // 0–100 baseline
    score += scoreLocationMatch(lead, location); // ±20 location modifier
    if (isKnownProfilePlatform(lead, targetType)) score += 15; // profile platform bonus
    return { ...lead, score: Math.max(0, Math.min(100, score)) };
  });

  // Step 5 — dedup
  const deduped = deduplicateLeads(scored);

  // Step 6 — filter & sort
  return deduped
    .filter((l) => (l.score ?? 0) > 5)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
