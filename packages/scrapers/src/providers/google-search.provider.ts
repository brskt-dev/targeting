import type { Lead, SearchInput } from "@targeting/shared";
import type { BrowserContext } from "playwright";
import type { ScraperProvider } from "../types";
import { buildProviderQueries, EFFORT_CONFIG } from "../query-builder";
import { createSearchContext, runSearchOnPage, delay } from "../utils/google-search-runner";
import { randomUUID } from "crypto";

async function search(input: SearchInput, sharedContext?: BrowserContext): Promise<Lead[]> {
  const queries = buildProviderQueries(input, "google_search");
  const { maxResults, pageTimeoutMs, interProviderDelayMs } =
    EFFORT_CONFIG[input.scrapeEffort ?? "balanced"];

  const context = sharedContext ?? (await createSearchContext());
  const ownsContext = !sharedContext;
  const allLeads: Lead[] = [];

  try {
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await delay(interProviderDelayMs + Math.random() * 1000);
      const raw = await runSearchOnPage(context, queries[i], maxResults, pageTimeoutMs);
      const leads = raw.map((r): Lead => ({
        id: randomUUID(),
        type: input.targetType,
        platform: "google_search",
        name: r.title,
        description: r.description,
        website: r.url,
        profileUrl: r.url,
        sourceUrl: r.url,
        location: input.location,
      }));
      allLeads.push(...leads);
    }
  } finally {
    if (ownsContext) await context.browser()?.close();
  }

  return allLeads;
}

export const googleSearchProvider: ScraperProvider = {
  platform: "google_search",
  search,
};
