import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { buildProviderQueries, EFFORT_CONFIG } from "../query-builder";
import { randomUUID } from "crypto";

async function search(input: SearchInput): Promise<Lead[]> {
  // Maps returns local businesses — not meaningful for person searches
  if (input.targetType === "person") return [];

  const [query] = buildProviderQueries(input, "google_maps");
  const { maxResults, pageTimeoutMs } = EFFORT_CONFIG[input.scrapeEffort ?? "balanced"];
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });

    // Wait for listing cards to appear rather than using a fixed timeout.
    try {
      await page.waitForSelector('[role="article"]', {
        timeout: Math.min(12000, pageTimeoutMs),
      });
    } catch {
      return [];
    }

    const results = await page.evaluate((limit: number) => {
      const items: Array<{
        name: string;
        description: string;
        address: string;
        phone: string;
        website: string;
        url: string;
      }> = [];

      document.querySelectorAll('[role="article"]').forEach((card) => {
        // Use semantic role selectors — stable across Maps HTML refreshes.
        const nameEl =
          card.querySelector('[role="heading"]') ??
          card.querySelector(".qBF1Pd, .fontHeadlineSmall");
        // Link to the place page — look for href containing /maps/place/ which is stable.
        const linkEl =
          (card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null) ??
          (card.querySelector("a.hfpxzc") as HTMLAnchorElement | null);
        if (!nameEl) return;

        items.push({
          name: nameEl.textContent?.trim() ?? "",
          description: card.querySelector(".W4Efsd")?.textContent?.trim() ?? "",
          address:
            card.querySelector(".W4Efsd:nth-child(2) .W4Efsd span")?.textContent?.trim() ?? "",
          phone: card.querySelector('[data-dtype="d3ph"]')?.textContent?.trim() ?? "",
          website:
            (card.querySelector('a[data-value="Website"]') as HTMLAnchorElement)?.href ?? "",
          url: linkEl?.href ?? "",
        });
      });

      return items.slice(0, limit);
    }, maxResults);

    return results
      .filter((r) => r.url && r.name)
      .map((r): Lead => ({
        id: randomUUID(),
        type: input.targetType,
        platform: "google_maps",
        name: r.name,
        description: r.description,
        website: r.website || undefined,
        profileUrl: r.url,
        sourceUrl: r.url,
        location: r.address || input.location,
        contact: { phone: r.phone || undefined },
      }));
  } finally {
    await browser.close();
  }
}

export const googleMapsProvider: ScraperProvider = {
  platform: "google_maps",
  search,
};
