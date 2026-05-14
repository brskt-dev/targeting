import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

// Strategy: use Google site: search to find public Instagram profiles.
// This avoids Instagram auth requirements and works with public pages only.
// TODO: Improve with direct Instagram Explore/hashtag scraping once
//       a reliable headless approach for public content is available.
async function search(input: SearchInput): Promise<Lead[]> {
  const siteQuery = input.location
    ? `site:instagram.com ${input.query} ${input.location}`
    : `site:instagram.com ${input.query}`;

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
        if (!href.includes("instagram.com")) return;

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
        const match = r.url.match(/instagram\.com\/([^/?#]+)/);
        const username = match?.[1];

        // Skip non-profile paths
        if (!username || ["p", "reel", "stories", "explore", "tv", "accounts"].includes(username)) {
          return null;
        }

        return {
          id: randomUUID(),
          type: input.targetType,
          platform: "instagram" as const,
          name: r.title.replace(/\s*[•·|]\s*Instagram.*$/i, "").trim() || username,
          username,
          description: r.description,
          profileUrl: `https://www.instagram.com/${username}/`,
          sourceUrl: `https://www.instagram.com/${username}/`,
          location: input.location,
        } satisfies Lead;
      })
      .filter((l): l is Lead => l !== null);
  } finally {
    await browser.close();
  }
}

export const instagramProvider: ScraperProvider = {
  platform: "instagram",
  search,
};
