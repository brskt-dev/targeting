import type { SearchInput, SearchResponse, ProviderError } from "@targeting/shared";
import { registry } from "./providers";

export async function runSearch(input: SearchInput): Promise<SearchResponse> {
  const providers = input.platforms
    .filter((p) => registry[p])
    .map((p) => registry[p]);

  const settled = await Promise.allSettled(providers.map((p) => p.search(input)));

  const results: SearchResponse["results"] = [];
  const errors: ProviderError[] = [];

  settled.forEach((outcome, i) => {
    const platform = providers[i].platform;
    if (outcome.status === "fulfilled") {
      results.push(...outcome.value);
    } else {
      errors.push({
        platform,
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  });

  return { results, errors };
}

export type { ScraperProvider } from "./types";
