import { chromium } from "playwright";
import type { Lead, SearchInput } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { randomUUID } from "crypto";

// Strategy: use Google site: search to find public LinkedIn company/profile pages.
// LinkedIn redirects unauthenticated users to login for direct searches,
// so we leverage Google's index of public LinkedIn pages.
// TODO: Explore LinkedIn public company search API for richer data.
async function search(input: SearchInput): Promise<Lead[]> {
  const pathPrefix =
    input.targetType === "company" ? "site:linkedin.com/company" : "site:linkedin.com/in";

  const siteQuery = input.location
    ? `${pathPrefix} ${input.query} ${input.location}`
    : `${pathPrefix} ${input.query}`;

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

        if (!href.includes("linkedin.com")) return;
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
