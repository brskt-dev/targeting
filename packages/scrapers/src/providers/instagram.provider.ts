import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

// Strategy: use Google site: search to find public Instagram profiles.
// This avoids Instagram auth requirements.
// TODO: Improve with direct Instagram Explore/hashtag scraping when a reliable
//       headless approach for public content is available.
async function search(input: SearchInput): Promise<Lead[]> {
  const siteQuery = input.location
    ? `site:instagram.com ${input.query} ${input.location}`
    : `site:instagram.com ${input.query}`;

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(siteQuery)}&num=15&hl=pt-BR`;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "pt-BR",
  });
  const page = await context.newPage();

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    try {
      await page.waitForSelector("h3", { timeout: 8000 });
    } catch {
      return [];
    }

    const results = await page.evaluate(() => {
      const items: Array<{ title: string; description: string; url: string }> = [];
      const seen = new Set<string>();

      document.querySelectorAll("h3").forEach((h3) => {
        let el: Element | null = h3;
        while (el && el.tagName !== "A") {
          el = el.parentElement;
        }
        if (!el) return;

        let href = (el as HTMLAnchorElement).href;

        // Handle Google redirect URLs
        if (href.includes("google.com/url") && href.includes("?q=")) {
          const match = href.match(/[?&]q=([^&]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }

        if (!href.includes("instagram.com")) return;
        if (seen.has(href)) return;
        seen.add(href);

        const container = el.closest("[data-hveid]") ?? el.parentElement;
        const desc =
          container?.querySelector("div[data-sncf], div.VwiC3b, div.IsZvec")?.textContent?.trim() ?? "";

        items.push({ title: h3.textContent?.trim() ?? "", description: desc, url: href });
      });

      return items.slice(0, 10);
    });

    return results
      .map((r) => {
        const match = r.url.match(/instagram\.com\/([^/?#]+)/);
        const username = match?.[1];

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
