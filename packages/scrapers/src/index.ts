import type { SearchInput, SearchResponse, ProviderError, Lead, Platform } from "@targeting/shared";
import { registry } from "./providers";
import { applyPostProcessing } from "./filters";
import { createSearchContext, delay } from "./utils/google-search-runner";
import { EFFORT_CONFIG } from "./query-builder";

// These providers all route through Google Search — they must run serially to avoid rate limiting.
const GOOGLE_SEARCH_PLATFORMS = new Set<Platform>(["google_search", "instagram", "linkedin"]);

export async function runSearch(input: SearchInput): Promise<SearchResponse> {
  const providers = input.platforms.filter((p) => registry[p]).map((p) => registry[p]);

  const googleProviders = providers.filter((p) => GOOGLE_SEARCH_PLATFORMS.has(p.platform));
  const directProviders = providers.filter((p) => !GOOGLE_SEARCH_PLATFORMS.has(p.platform));

  const raw: Lead[] = [];
  const errors: ProviderError[] = [];

  function collect(outcome: PromiseSettledResult<Lead[]>, platform: Platform) {
    if (outcome.status === "fulfilled") {
      raw.push(...outcome.value);
    } else {
      errors.push({
        platform,
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  }

  // Direct providers (Google Maps) run in parallel — não usam Google Search.
  const directSettledPromise = Promise.allSettled(directProviders.map((p) => p.search(input)));

  // Providers que usam Google Search compartilham UM contexto de browser e rodam em série.
  // Um único contexto = uma única sessão do Google = menos suspeita de bot.
  // A serialização garante que nunca há duas buscas simultâneas no mesmo Google.
  const googleSettledPromise = (async (): Promise<PromiseSettledResult<Lead[]>[]> => {
    const outcomes: PromiseSettledResult<Lead[]>[] = [];
    if (googleProviders.length === 0) return outcomes;

    const { interProviderDelayMs } = EFFORT_CONFIG[input.scrapeEffort ?? "balanced"];
    const sharedContext = await createSearchContext();
    try {
      for (let i = 0; i < googleProviders.length; i++) {
        if (i > 0) await delay(interProviderDelayMs + Math.random() * 1000);
        try {
          outcomes.push({
            status: "fulfilled",
            value: await googleProviders[i].search(input, sharedContext),
          });
        } catch (e) {
          outcomes.push({ status: "rejected", reason: e });
        }
      }
    } finally {
      await sharedContext.browser()?.close();
    }
    return outcomes;
  })();

  const [directSettled, googleSettled] = await Promise.all([
    directSettledPromise,
    googleSettledPromise,
  ]);

  directSettled.forEach((outcome, i) => collect(outcome, directProviders[i].platform));
  googleSettled.forEach((outcome, i) => collect(outcome, googleProviders[i].platform));

  console.log(
    "[runSearch] raw per provider:",
    [...directProviders, ...googleProviders].map((p, i) => {
      const outcome = [...directSettled, ...googleSettled][i];
      return `${p.platform}=${outcome.status === "fulfilled" ? outcome.value.length : "ERR"}`;
    }).join(", ")
  );

  const results = applyPostProcessing(raw, input);
  console.log(`[runSearch] after post-processing: ${results.length} leads (from ${raw.length} raw)`);
  return { results, errors };
}

export type { ScraperProvider } from "./types";
