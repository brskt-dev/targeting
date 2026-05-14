import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

// Strategy: use Google site: search to find public LinkedIn company/profile pages.
// LinkedIn redirects unauthenticated users to login for direct searches,
// so we leverage Google's index of public LinkedIn pages.
// TODO: Explore LinkedIn public company search API or partnerships for richer data.
async function search(input: SearchInput): Promise<Lead[]> {
  const pathPrefix =
    input.targetType === "company" ? "site:linkedin.com/company" : "site:linkedin.com/in";

  const siteQuery = input.location
    ? `${pathPrefix} ${input.query} ${input.location}`
    : `${pathPrefix} ${input.query}`;

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(siteQuery)}&num=15`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const results = await page.evaluate(() => {
      const items: Array<{ title: string; description: string; url: string }> = [];

      document.querySelectorAll("div.g, div[data-hveid]").forEach((card) => {
        const titleEl = card.querySelector("h3");
        const linkEl = card.querySelector("a[href]");
        const descEl = card.querySelector("div.VwiC3b, div.IsZvec");

        if (!titleEl || !linkEl) return;

        const href = (linkEl as HTMLAnchorElement).href;
        if (!href.includes("linkedin.com")) return;

        items.push({
          title: titleEl.textContent?.trim() ?? "",
          description: descEl?.textContent?.trim() ?? "",
          url: href,
        });
      });

      return items.slice(0, 10);
    });

    return results
      .map((r) => {
        const companyMatch = r.url.match(/linkedin\.com\/company\/([^/?#]+)/);
        const personMatch = r.url.match(/linkedin\.com\/in\/([^/?#]+)/);
        const slug = companyMatch?.[1] ?? personMatch?.[1];

        if (!slug) return null;

        return {
          id: randomUUID(),
          type: input.targetType,
          platform: "linkedin" as const,
          name: r.title.replace(/\s*[|·•]\s*LinkedIn.*$/i, "").trim() || slug,
          username: slug,
          description: r.description,
          profileUrl: r.url,
          sourceUrl: r.url,
          location: input.location,
        } satisfies Lead;
      })
      .filter((l): l is Lead => l !== null);
  } finally {
    await browser.close();
  }
}

export const linkedinProvider: ScraperProvider = {
  platform: "linkedin",
  search,
};
