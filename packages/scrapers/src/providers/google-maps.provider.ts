import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

async function search(input: SearchInput): Promise<Lead[]> {
  const query = input.location ? `${input.query} ${input.location}` : input.query;
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const results = await page.evaluate(() => {
      const items: Array<{
        name: string;
        description: string;
        address: string;
        phone: string;
        website: string;
        url: string;
      }> = [];

      document.querySelectorAll('[role="article"]').forEach((card) => {
        const nameEl = card.querySelector(".qBF1Pd, .fontHeadlineSmall");
        const linkEl = card.querySelector("a.hfpxzc");

        if (!nameEl) return;

        items.push({
          name: nameEl.textContent?.trim() ?? "",
          description: card.querySelector(".W4Efsd")?.textContent?.trim() ?? "",
          address: card.querySelector(".W4Efsd:nth-child(2) .W4Efsd span")?.textContent?.trim() ?? "",
          phone: card.querySelector('[data-dtype="d3ph"]')?.textContent?.trim() ?? "",
          website: (card.querySelector('a[data-value="Website"]') as HTMLAnchorElement)?.href ?? "",
          url: (linkEl as HTMLAnchorElement)?.href ?? searchUrl,
        });
      });

      return items.slice(0, 15);
    });

    return results.map((r) => ({
      id: randomUUID(),
      type: input.targetType,
      platform: "google_maps" as const,
      name: r.name,
      description: r.description,
      website: r.website || undefined,
      profileUrl: r.url,
      sourceUrl: r.url,
      location: r.address || input.location,
      contact: {
        phone: r.phone || undefined,
      },
    }));
  } finally {
    await browser.close();
  }
}

export const googleMapsProvider: ScraperProvider = {
  platform: "google_maps",
  search,
};
