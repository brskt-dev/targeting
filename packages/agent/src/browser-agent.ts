import { chromium, type BrowserContext, type Page } from "playwright";
import { browserProfileDir } from "@targeting/storage";

export type BrowserAgentOptions = {
  connectionId: string;
  headless?: boolean;
  startUrl?: string;
};

export type ClickFallback = {
  text?: string;
  ariaLabel?: string;
};

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '\\"');
}

// Pseudo-labels que o observer injeta (ex: "[FILTRO DE DATE — valor...]",
// "[ícone: refresh]") não devem ser usados como texto de fallback porque
// não correspondem a texto real visível.
function isPlaceholderLabel(s: string): boolean {
  return /^\[(FILTRO DE|ícone:|campo )/i.test(s);
}

// Encapsula um contexto persistente do Playwright por connectionId.
// O usuário faz login manual no browser; a sessão fica salva em userDataDir.
export class BrowserAgent {
  private ctx: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(private readonly opts: BrowserAgentOptions) {}

  async open(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;
    const userDataDir = browserProfileDir(this.opts.connectionId);
    this.ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: this.opts.headless ?? false,
      viewport: { width: 1280, height: 800 },
    });
    const pages = this.ctx.pages();
    this.page = pages.length > 0 ? pages[0] : await this.ctx.newPage();
    if (this.opts.startUrl) {
      await this.page.goto(this.opts.startUrl, { waitUntil: "domcontentloaded" });
    }
    return this.page;
  }

  currentPage(): Page | null {
    return this.page;
  }

  async navigate(url: string): Promise<void> {
    const page = await this.open();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  async clickByHint(selectorHint: string, fallback?: ClickFallback): Promise<void> {
    const page = await this.open();
    const hint = (selectorHint ?? "").trim();
    if (!hint) throw new Error("selectorHint vazio");

    const strategies: Array<{ name: string; make: () => import("playwright").Locator }> = [];

    const looksLikePlaywrightSelector =
      /^(text=|role=|xpath=|css=|\/\/|#|\.|\[|html|body)/i.test(hint) ||
      /^[a-z]+\[/i.test(hint);

    if (looksLikePlaywrightSelector) {
      strategies.push({ name: `locator(${truncate(hint)})`, make: () => page.locator(hint) });
    }

    const fallbackText = (fallback?.text ?? "").trim();
    const fallbackAria = (fallback?.ariaLabel ?? "").trim();
    if (fallbackText && fallbackText.length < 80 && !isPlaceholderLabel(fallbackText)) {
      strategies.push({ name: `getByText(${truncate(fallbackText)},exact)`, make: () => page.getByText(fallbackText, { exact: true }) });
      strategies.push({ name: `getByRole(button,${truncate(fallbackText)})`, make: () => page.getByRole("button", { name: fallbackText }) });
      strategies.push({ name: `getByRole(link,${truncate(fallbackText)})`, make: () => page.getByRole("link", { name: fallbackText }) });
      strategies.push({ name: `getByRole(menuitem,${truncate(fallbackText)})`, make: () => page.getByRole("menuitem", { name: fallbackText }) });
      strategies.push({ name: `getByText(${truncate(fallbackText)})`, make: () => page.getByText(fallbackText) });
    }
    if (fallbackAria) {
      strategies.push({ name: `[aria-label]`, make: () => page.locator(`[aria-label="${escapeAttr(fallbackAria)}"]`) });
    }
    if (!looksLikePlaywrightSelector && hint.length < 80) {
      strategies.push({ name: `getByText(${truncate(hint)})`, make: () => page.getByText(hint) });
      strategies.push({ name: `getByRole(button,${truncate(hint)})`, make: () => page.getByRole("button", { name: hint }) });
    }

    const triedNames: string[] = [];
    let lastError: string | undefined;
    for (const s of strategies) {
      triedNames.push(s.name);
      try {
        const loc = s.make().first();
        const count = await loc.count();
        if (count === 0) continue;
        // Tenta clicar com 3 modos em cascata: normal -> force -> JS direto.
        // "force" ignora actionability checks (overlay invisível, animação não estável).
        // "JS direto" dispara o handler via .click() do DOM, último recurso.
        await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        try {
          await loc.click({ timeout: 2500 });
          return;
        } catch (e1) {
          lastError = `normal: ${(e1 as Error).message.slice(0, 80)}`;
        }
        try {
          await loc.click({ force: true, timeout: 2000 });
          return;
        } catch (e2) {
          lastError = `force: ${(e2 as Error).message.slice(0, 80)}`;
        }
        try {
          await loc.evaluate((el) => (el as HTMLElement).click());
          return;
        } catch (e3) {
          lastError = `js: ${(e3 as Error).message.slice(0, 80)}`;
        }
      } catch (err) {
        lastError = (err as Error).message;
      }
    }
    throw new Error(`não consegui clicar em "${truncate(hint)}". estratégias: ${triedNames.join(" | ")}${lastError ? ` | último: ${lastError}` : ""}`);
  }

  async fillInput(selectorHint: string, value: string): Promise<void> {
    const page = await this.open();
    const hint = (selectorHint ?? "").trim();
    if (!hint) throw new Error("selectorHint vazio");

    const looksLikeCss = /^(input|select|textarea|\[|#|\.)/i.test(hint);

    const candidates: Array<() => import("playwright").Locator> = [];
    if (looksLikeCss) {
      // LLM provavelmente mandou um seletor CSS direto (ex: input[type="date"])
      candidates.push(() => page.locator(hint));
    }
    // Tentativas baseadas em texto/label
    candidates.push(() => page.getByLabel(hint));
    candidates.push(() => page.getByPlaceholder(hint));
    candidates.push(() => page.getByRole("textbox", { name: hint }));
    candidates.push(() => page.locator(`input[aria-label*="${hint}" i]`));
    candidates.push(() => page.locator(`input[placeholder*="${hint}" i]`));
    candidates.push(() => page.locator(`input[name="${hint}"]`));
    candidates.push(() => page.locator(hint)); // último fallback: trata como CSS

    let target: import("playwright").Locator | null = null;
    let inputType = "";
    for (const make of candidates) {
      try {
        const loc = make().first();
        if (await loc.count() === 0) continue;
        inputType = (await loc.getAttribute("type").catch(() => "")) ?? "";
        target = loc;
        break;
      } catch { /* ignore */ }
    }
    if (!target) throw new Error(`input não encontrado para "${hint}"`);

    // Normaliza datas: input[type=date] espera yyyy-mm-dd.
    let toFill = value;
    if (inputType === "date") {
      const m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
      if (m) {
        const [, d, mo, y] = m;
        const year = y.length === 2 ? `20${y}` : y;
        toFill = `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }

    await target.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    await target.fill(toFill, { timeout: 5000 });
    // Tenta commits comuns: Enter (filtros) e blur via Tab (forms). Os dois são
    // inofensivos em campos read-only; quem precisar dispara, quem não, ignora.
    await target.press("Enter", { timeout: 1500 }).catch(() => {});
    await target.press("Tab", { timeout: 1500 }).catch(() => {});
  }

  async scroll(direction: "down" | "up", amount = 800): Promise<void> {
    const page = await this.open();
    const delta = direction === "down" ? amount : -amount;
    await page.evaluate((d) => window.scrollBy(0, d), delta);
  }

  async goBack(): Promise<void> {
    const page = await this.open();
    await page.goBack({ waitUntil: "domcontentloaded" });
  }

  async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async screenshot(filePath: string): Promise<void> {
    const page = await this.open();
    await page.screenshot({ path: filePath, fullPage: false });
  }

  // Captura screenshot em PNG → base64.
  // - withLabels: sobrepõe badges vermelhos com o id `el-N` sobre cada elemento
  //   que tem data-targeting-id. Crítico para o LLM correlacionar visualmente
  //   qual id corresponde a qual botão/input/etc. na imagem.
  // - fullPage: captura página inteira (não só viewport).
  async screenshotBase64(opts: { withLabels?: boolean; fullPage?: boolean } = {}): Promise<string> {
    const page = await this.open();

    if (opts.withLabels) {
      await page.evaluate(() => {
        // Remove badges antigos por garantia
        document.querySelectorAll("[data-targeting-badge]").forEach((n) => n.remove());
        const els = document.querySelectorAll<HTMLElement>("[data-targeting-id]");
        for (const el of Array.from(els)) {
          const id = el.getAttribute("data-targeting-id");
          if (!id) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) continue;
          if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
          const badge = document.createElement("div");
          badge.setAttribute("data-targeting-badge", "1");
          badge.textContent = id;
          badge.style.cssText = [
            "position:fixed",
            `top:${Math.max(0, rect.top - 2)}px`,
            `left:${Math.max(0, rect.left - 2)}px`,
            "background:rgba(220,38,38,0.92)",
            "color:#fff",
            "font-size:10px",
            "font-family:ui-monospace,Menlo,monospace",
            "font-weight:700",
            "padding:1px 4px",
            "border-radius:3px",
            "line-height:1.2",
            "box-shadow:0 0 0 1px rgba(0,0,0,0.4)",
            "z-index:2147483647",
            "pointer-events:none",
          ].join(";");
          document.body.appendChild(badge);
        }
      });
    }

    const buf = await page.screenshot({ fullPage: opts.fullPage ?? false, type: "png" });

    if (opts.withLabels) {
      await page.evaluate(() => {
        document.querySelectorAll("[data-targeting-badge]").forEach((n) => n.remove());
      });
    }

    return buf.toString("base64");
  }

  async close(): Promise<void> {
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
      this.page = null;
    }
  }
}

// Pool simples para reusar agents por connectionId enquanto a sessão estiver viva.
const pool = new Map<string, BrowserAgent>();

export function getOrCreateAgent(opts: BrowserAgentOptions): BrowserAgent {
  const existing = pool.get(opts.connectionId);
  if (existing) return existing;
  const created = new BrowserAgent(opts);
  pool.set(opts.connectionId, created);
  return created;
}

export async function disposeAgent(connectionId: string): Promise<void> {
  const a = pool.get(connectionId);
  if (a) {
    await a.close();
    pool.delete(connectionId);
  }
}
