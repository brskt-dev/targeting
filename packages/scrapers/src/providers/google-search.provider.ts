import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

async function search(input: SearchInput): Promise<Lead[]> {
  const query = input.location ? `${input.query} ${input.location}` : input.query;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" });
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const results = await page.evaluate(() => {
      const items: Array<{ name: string; description: string; url: string }> = [];

      document.querySelectorAll("div.g, div[data-hveid]").forEach((card) => {
        const titleEl = card.querySelector("h3");
        const linkEl = card.querySelector("a[href]");
        const descEl = card.querySelector("div.VwiC3b, div.IsZvec");

        if (!titleEl || !linkEl) return;

        const href = (linkEl as HTMLAnchorElement).href;
        if (!href || href.startsWith("https://www.google")) return;

        items.push({
          name: titleEl.textContent?.trim() ?? "",
          description: descEl?.textContent?.trim() ?? "",
          url: href,
        });
      });

      return items.slice(0, 15);
    });

    return results.map((r) => ({
      id: randomUUID(),
      type: input.targetType,
      platform: "google_search" as const,
      name: r.name,
      description: r.description,
      website: r.url,
      profileUrl: r.url,
      sourceUrl: r.url,
      location: input.location,
    }));
  } finally {
    await browser.close();
  }
}

export const googleSearchProvider: ScraperProvider = {
  platform: "google_search",
  search,
};
