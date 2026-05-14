import type { Lead, SearchInput } from "@targeting/shared";
import type { BrowserContext } from "playwright";
import type { ScraperProvider } from "../types";
import { buildProviderQueries, EFFORT_CONFIG } from "../query-builder";
import { createSearchContext, runSearchOnPage } from "../utils/google-search-runner";
import { randomUUID } from "crypto";

// Strategy: Google site:linkedin.com/in (person) or site:linkedin.com/company (company).
// LinkedIn redirects unauthenticated users to login for direct searches.
async function search(input: SearchInput, sharedContext?: BrowserContext): Promise<Lead[]> {
  const [query] = buildProviderQueries(input, "linkedin");
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
    .filter((r) => r.url.includes("linkedin.com"))
    .map((r): Lead | null => {
      const companyMatch = r.url.match(/linkedin\.com\/company\/([^/?#]+)/);
      const personMatch = r.url.match(/linkedin\.com\/in\/([^/?#]+)/);
      const slug = companyMatch?.[1] ?? personMatch?.[1];

      if (!slug) return null;

      // Hard-filter by targetType — query builder already targets the right path,
      // but Google may occasionally return other LinkedIn pages
      if (input.targetType === "person" && !personMatch) return null;
      if (input.targetType === "company" && !companyMatch) return null;

      return {
        id: randomUUID(),
        type: input.targetType,
        platform: "linkedin",
        name: r.title.replace(/\s*[|·•]\s*LinkedIn.*$/i, "").trim() || slug,
        username: slug,
        description: r.description,
        profileUrl: r.url,
        sourceUrl: r.url,
        location: input.location,
      };
    })
    .filter((l): l is Lead => l !== null);
}

export const linkedinProvider: ScraperProvider = {
  platform: "linkedin",
  search,
};
