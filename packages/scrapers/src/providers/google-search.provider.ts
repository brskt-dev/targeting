import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

function resolveGoogleRedirect(href: string): string {
  if (href.includes("google.com/url") && href.includes("?q=")) {
    const match = href.match(/[?&]q=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return href;
}

async function search(input: SearchInput): Promise<Lead[]> {
  const query = input.location ? `${input.query} ${input.location}` : input.query;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=20&hl=pt-BR`;

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

    // Wait for at least one search result title to appear
    try {
      await page.waitForSelector("h3", { timeout: 8000 });
    } catch {
      return [];
    }

    const results = await page.evaluate(() => {
      const items: Array<{ name: string; description: string; url: string }> = [];
      const seen = new Set<string>();

      // Strategy: every Google result title is an h3; walk up to find its parent anchor
      document.querySelectorAll("h3").forEach((h3) => {
        let el: Element | null = h3;
        while (el && el.tagName !== "A") {
          el = el.parentElement;
        }
        if (!el) return;

        const href = (el as HTMLAnchorElement).href;
        if (!href || !href.startsWith("http") || href.includes("google.com")) return;
        if (seen.has(href)) return;
        seen.add(href);

        const container = el.closest("[data-hveid]") ?? el.parentElement;
        const desc =
          container?.querySelector("div[data-sncf], div.VwiC3b, div.IsZvec")?.textContent?.trim() ?? "";

        items.push({ name: h3.textContent?.trim() ?? "", description: desc, url: href });
      });

      return items.slice(0, 15);
    });

    return results.map((r) => ({
      id: randomUUID(),
      type: input.targetType,
      platform: "google_search" as const,
      name: r.name,
      description: r.description,
      website: resolveGoogleRedirect(r.url),
      profileUrl: resolveGoogleRedirect(r.url),
      sourceUrl: resolveGoogleRedirect(r.url),
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
