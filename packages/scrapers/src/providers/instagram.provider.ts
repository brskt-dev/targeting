import type { Lead, SearchInput } from "@targeting/shared";
import type { BrowserContext } from "playwright";
import type { ScraperProvider } from "../types";
import { buildProviderQueries, EFFORT_CONFIG } from "../query-builder";
import { createSearchContext, runSearchOnPage } from "../utils/google-search-runner";
import { randomUUID } from "crypto";

const INSTAGRAM_NON_PROFILE_PATHS = ["p", "reel", "stories", "explore", "tv", "accounts", "about"];

// Strategy: Google site:instagram.com search — no auth required.
async function search(input: SearchInput, sharedContext?: BrowserContext): Promise<Lead[]> {
  const [query] = buildProviderQueries(input, "instagram");
  const { maxResults, pageTimeoutMs } = EFFORT_CONFIG[input.scrapeEffort ?? "balanced"];

  const context = sharedContext ?? (await createSearchContext());
  const ownsContext = !sharedContext;

  let raw;
  try {
    raw = await runSearchOnPage(context, query, maxResults, pageTimeoutMs);
  } finally {
    if (ownsContext) await context.browser()?.close();
  }

  return raw
    .filter((r) => r.url.includes("instagram.com"))
    .map((r): Lead | null => {
      const match = r.url.match(/instagram\.com\/([^/?#]+)/);
      const username = match?.[1];

      if (!username || INSTAGRAM_NON_PROFILE_PATHS.includes(username)) return null;

      return {
        id: randomUUID(),
        type: input.targetType,
        platform: "instagram",
        name: r.title.replace(/\s*[•·|]\s*Instagram.*$/i, "").trim() || username,
        username,
        description: r.description,
        profileUrl: `https://www.instagram.com/${username}/`,
        sourceUrl: `https://www.instagram.com/${username}/`,
        location: input.location,
      };
    })
    .filter((l): l is Lead => l !== null);
}

export const instagramProvider: ScraperProvider = {
  platform: "instagram",
  search,
};
