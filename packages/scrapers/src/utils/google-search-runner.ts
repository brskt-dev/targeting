import { chromium, type BrowserContext } from "playwright";

export interface RawSearchResult {
  title: string;
  description: string;
  url: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Creates a Chromium browser context configured to look like a real user.
 * The caller is responsible for closing the context (and therefore the browser).
 */
export async function createSearchContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--no-first-run"],
  });
  return browser.newContext({
    userAgent: USER_AGENT,
    locale: "pt-BR",
    viewport: { width: 1920, height: 1080 },
  });
}

/**
 * Runs a single Google search on an existing page within a shared context.
 * Opens a new page tab, performs the search, then closes the tab.
 */
export async function runSearchOnPage(
  context: BrowserContext,
  query: string,
  maxResults: number,
  pageTimeoutMs: number,
): Promise<RawSearchResult[]> {
  const num = Math.min(maxResults, 30);
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${num}&hl=pt-BR`;

  const page = await context.newPage();
  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: pageTimeoutMs });

    try {
      await page.waitForSelector("h3", { timeout: Math.min(8000, pageTimeoutMs) });
    } catch {
      return [];
    }

    return await page.evaluate((limit: number) => {
      const items: Array<{ title: string; description: string; url: string }> = [];
      const seen = new Set<string>();

      document.querySelectorAll("h3").forEach((h3) => {
        let el: Element | null = h3;
        while (el && el.tagName !== "A") {
          el = el.parentElement;
        }
        if (!el) return;

        let href = (el as HTMLAnchorElement).href;

        if (href.includes("google.com/url") && href.includes("?q=")) {
          const match = href.match(/[?&]q=([^&]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }

        if (!href || !href.startsWith("http") || href.includes("google.com")) return;
        if (seen.has(href)) return;
        seen.add(href);

        const container = el.closest("[data-hveid]") ?? el.parentElement;
        const desc =
          container?.querySelector("div[data-sncf], div.VwiC3b, div.IsZvec")?.textContent?.trim() ??
          "";

        items.push({ title: h3.textContent?.trim() ?? "", description: desc, url: href });
      });

      return items.slice(0, limit);
    }, num);
  } finally {
    await page.close();
  }
}

/**
 * Convenience wrapper: creates a browser, runs one search, then closes it.
 * Used by providers that only need a single query (Instagram, LinkedIn).
 */
export async function runGoogleSearch(
  query: string,
  maxResults: number,
  pageTimeoutMs: number,
): Promise<RawSearchResult[]> {
  const context = await createSearchContext();
  try {
    return await runSearchOnPage(context, query, maxResults, pageTimeoutMs);
  } finally {
    await context.browser()?.close();
  }
}

/** Millisecond delay, useful for spacing out sequential Google requests. */
export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
