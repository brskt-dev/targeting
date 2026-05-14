import type { Platform, SearchInput, ScrapeEffort } from "@targeting/shared";

export const EFFORT_CONFIG: Record<
  ScrapeEffort,
  { maxResults: number; pageTimeoutMs: number; interProviderDelayMs: number }
> = {
  fast:     { maxResults: 5,  pageTimeoutMs: 10000, interProviderDelayMs: 1500 },
  balanced: { maxResults: 15, pageTimeoutMs: 20000, interProviderDelayMs: 3000 },
  deep:     { maxResults: 30, pageTimeoutMs: 40000, interProviderDelayMs: 5000 },
};

// Negative operators that push corporate/job/news content out of person searches
const PERSON_NEGATIVE_TERMS = [
  "-vagas",
  "-vaga",
  "-jobs",
  "-recrutamento",
  "-hiring",
  "-contratando",
  "-empresa",
  "-empresas",
  "-ltda",
  "-eireli",
  "-consultoria",
  "-\"software house\"",
  "-agência",
  "-agencia",
  "-campeonato",
  "-championship",
  "-torneio",
  "-noticia",
  "-noticias",
  "-artigo",
  "-article",
  "-blog",
  "-wiki",
].join(" ");

function q(s: string): string {
  return `"${s}"`;
}

/**
 * Returns one or more Google search queries for a given provider + SearchInput.
 * Multiple queries are returned for deep effort on google_search + person,
 * where each query targets a different profile platform.
 */
export function buildProviderQueries(input: SearchInput, platform: Platform): string[] {
  const { query, location, targetType, scrapeEffort = "balanced" } = input;
  const loc = location?.trim() || undefined;
  const ql = q(query);
  const locPart = loc ? ` ${q(loc)}` : "";

  switch (platform) {
    case "google_search": {
      if (targetType === "person") {
        // Each query targets a specific profile platform via site: operator.
        // fast → only LinkedIn profiles (most reliable for professionals)
        // balanced → LinkedIn + broad filtered search
        // deep → adds Instagram + GitHub
        const linkedin = `site:linkedin.com/in ${ql}${locPart}`;
        const broad = `${ql}${locPart} ${PERSON_NEGATIVE_TERMS}`;
        const instagram = `site:instagram.com ${ql}${locPart} -vagas -empresa`;
        const github = `site:github.com ${ql}${locPart}`;

        if (scrapeEffort === "fast") return [linkedin];
        if (scrapeEffort === "balanced") return [linkedin, broad];
        return [linkedin, broad, instagram, github];
      }

      // company: plain query for organic results
      const base = loc ? `${query} ${loc}` : query;
      if (scrapeEffort === "deep") {
        return [base, `site:linkedin.com/company ${query}${loc ? ` ${loc}` : ""}`];
      }
      return [base];
    }

    case "google_maps":
      // Maps is always for companies/local businesses — single query
      return [loc ? `${query} ${loc}` : query];

    case "instagram": {
      const exclusions =
        targetType === "person" ? " -vagas -jobs -empresa -contratando" : "";
      return [`site:instagram.com ${query}${loc ? ` ${loc}` : ""}${exclusions}`];
    }

    case "linkedin": {
      if (targetType === "person") {
        // /in/ path only contains personal profiles
        return [`site:linkedin.com/in ${ql}${locPart}`];
      }
      return [`site:linkedin.com/company ${query}${loc ? ` ${loc}` : ""}`];
    }
  }
}
