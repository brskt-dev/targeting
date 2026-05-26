import type {
  PageObservation,
  PageInteractiveElement,
  PageLink,
  PageTable,
} from "@targeting/shared";
import type { Page } from "playwright";

// Produz uma representação compacta da página atual.
// Texto visível truncado, elementos interativos com role/text/aria, links e tabelas.
export async function observePage(page: Page): Promise<PageObservation> {
  // Dá tempo para a SPA renderizar antes de fotografar o DOM.
  await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);

  const url = page.url();
  const title = await page.title().catch(() => undefined);

  const visibleText = (await page
    .evaluate(() => {
      const body = document.body;
      if (!body) return "";
      // Preserva quebras de linha (cada linha pode ser uma row da lista).
      // Só colapsa espaços/tabs dentro de uma linha e múltiplas quebras consecutivas.
      return (body.innerText || "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{2,}/g, "\n")
        .trim();
    })
    .catch(() => "")) as string;

  const interactiveElements = (await page
    .evaluate(() => {
      const SEMANTIC =
        "a,button,[role='button'],[role='link'],[role='tab'],[role='menuitem'],input,select,textarea,[contenteditable='true']";
      // Captura também elementos genéricos (div/li/span) que se comportam como clicáveis.
      // Dashboards SPA usam muito card div com onClick em vez de <button>/<a>.
      const semantic = Array.from(document.querySelectorAll<HTMLElement>(SEMANTIC));

      const candidatesGeneric = Array.from(
        document.querySelectorAll<HTMLElement>(
          "div,li,span,article,section",
        ),
      ).filter((el) => {
        // Filtra os que parecem clicáveis: cursor pointer, ou class com pista, ou onclick inline
        if (el.matches(SEMANTIC)) return false;
        if ((el as HTMLElement & { onclick?: unknown }).onclick) return true;
        const cls = (el.className && typeof el.className === "string") ? el.className.toLowerCase() : "";
        if (/(^|[\s_-])(card|tile|menu-?item|nav-?item|clickable|btn|module|widget|panel)([\s_-]|$)/.test(cls)) return true;
        try {
          const style = getComputedStyle(el);
          if (style.cursor === "pointer") return true;
        } catch { /* ignore */ }
        return false;
      });

      const all = [...semantic, ...candidatesGeneric];

      const seenText = new Set<string>();
      const items: Array<{
        id: string;
        role?: string;
        text?: string;
        ariaLabel?: string;
        selectorHint?: string;
      }> = [];

      // Limpa marcações de observações anteriores para não vazar entre runs.
      document.querySelectorAll("[data-targeting-id]").forEach((n) => {
        n.removeAttribute("data-targeting-id");
      });

      for (const el of all) {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 2 && rect.height > 2;
        if (!visible) continue;

        const ariaLabel = el.getAttribute("aria-label") ?? undefined;
        const tag = el.tagName.toLowerCase();

        let role: string = el.getAttribute("role") ?? tag;
        let text: string | undefined;

        if (tag === "input" || tag === "select" || tag === "textarea") {
          const inputType = el.getAttribute("type") || (tag === "input" ? "text" : tag);
          const inputValue = (el as HTMLInputElement).value || "";
          const placeholder = el.getAttribute("placeholder") || "";
          const inputName = el.getAttribute("name") || "";

          role = `${inputType}-${tag}`;

          if (inputType === "date" || inputType === "datetime-local" || inputType === "month" || inputType === "time") {
            text = `[FILTRO DE ${inputType.toUpperCase()} — valor atual: ${inputValue || "(vazio)"}]`;
          } else {
            const desc = placeholder || inputName || ariaLabel || "(sem label)";
            text = `[campo ${inputType}: "${desc}"${inputValue ? `, valor atual: "${inputValue}"` : ""}]`;
          }
        } else {
          const directText = (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 120);
          text = directText || undefined;

          // Botões/links só com ícone (sem texto) ficam invisíveis pro LLM.
          // Capturamos pistas: classes de ícone (fa-refresh, icon-search),
          // title/alt em children, conteúdo de <use href> em SVG.
          if (!text) {
            const iconCandidates = el.querySelectorAll<HTMLElement>("i[class], svg, img, use, [class*='icon'], [class*='fa-']");
            const hints: string[] = [];
            for (const ic of Array.from(iconCandidates).slice(0, 3)) {
              const cls = (typeof ic.className === "string" ? ic.className : ((ic.className as unknown as { baseVal?: string })?.baseVal ?? "")) ?? "";
              const m = cls.match(/(refresh|reload|search|find|filter|edit|delete|trash|add|new|plus|save|cancel|close|menu|arrow|chevron|expand|collapse|up|down|left|right|next|prev|previous|home|user|profile|settings|gear|cog|info|help|warning|error|check|ok|calendar|date|time|clock|export|download|upload|print|share|copy|link)\b/i);
              if (m) hints.push(m[0].toLowerCase());
              const title = ic.getAttribute("title");
              if (title) hints.push(`"${title.slice(0, 30)}"`);
              const useHref = ic.querySelector("use")?.getAttribute("href")
                ?? ic.querySelector("use")?.getAttribute("xlink:href");
              if (useHref) hints.push(useHref.replace(/^#?icon-?/, "").slice(0, 30));
            }
            const titleAttr = el.getAttribute("title") ?? el.getAttribute("data-tooltip") ?? "";
            if (titleAttr) hints.push(`"${titleAttr.slice(0, 40)}"`);
            if (hints.length > 0) text = `[ícone: ${Array.from(new Set(hints)).join(", ")}]`;
          }
        }

        // Dedup: dois elementos com mesmo role + texto + aria → fica só o primeiro.
        // Mas inputs SEMPRE entram (mesmo sem texto), porque o LLM precisa vê-los.
        const key = `${role}|${(text ?? "").toLowerCase()}|${(ariaLabel ?? "").toLowerCase()}`;
        const isFormField = ["input", "select", "textarea"].includes(tag);
        if (!isFormField && (key.endsWith("||") || seenText.has(key))) continue;
        seenText.add(key);

        // Injeta atributo único na DOM — vira o seletor que usamos depois.
        // Funciona mesmo quando o site tem id duplicado ou estrutura ambígua.
        const targetingId = `el-${items.length}`;
        el.setAttribute("data-targeting-id", targetingId);

        items.push({
          id: targetingId,
          role,
          text,
          ariaLabel,
          selectorHint: `[data-targeting-id="${targetingId}"]`,
        });

        if (items.length >= 120) break;
      }
      return items;
    })
    .catch(() => [])) as Array<PageInteractiveElement | null>;

  const links = (await page
    .evaluate(() => {
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      return anchors.slice(0, 150).map((a) => ({
        text: (a.innerText || "").trim().slice(0, 200) || undefined,
        href: a.href,
      }));
    })
    .catch(() => [])) as PageLink[];

  const tables = (await page
    .evaluate(() => {
      const out: { headers: string[]; rowsPreview: string[][] }[] = [];

      // 1) Tabelas HTML clássicas
      const tablesEls = Array.from(document.querySelectorAll("table"));
      for (const t of tablesEls.slice(0, 5)) {
        const headerCells = Array.from(t.querySelectorAll<HTMLTableCellElement>("thead th"));
        const headers = headerCells.map((th) => (th.innerText || "").trim()).filter(Boolean);
        const rows = Array.from(t.querySelectorAll("tbody tr")).slice(0, 15);
        const rowsPreview = rows.map((tr) =>
          Array.from(tr.querySelectorAll<HTMLTableCellElement>("td")).map((td) =>
            (td.innerText || "").trim(),
          ),
        );
        out.push({ headers, rowsPreview });
      }

      // 2) Listas virtuais: containers com 3+ filhos compartilhando estrutura
      // (mesma tag + mesma 1ª classe). Cobre grids de cards/linhas em SPAs que
      // não usam <table>. Cada filho vira uma "row" de preview.
      const candidateContainers = Array.from(document.querySelectorAll<HTMLElement>(
        "div, ul, ol, section, main, [role='list'], [role='grid']",
      ));
      const seenSignatures = new Set<string>();
      for (const container of candidateContainers) {
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length < 3 || children.length > 200) continue;

        // Assinatura de cada filho: tag + 1ª classe
        const sigOf = (c: HTMLElement) => {
          const firstClass = (c.className && typeof c.className === "string")
            ? c.className.split(/\s+/)[0]
            : "";
          return `${c.tagName}.${firstClass}`;
        };
        const sigs = children.map(sigOf);
        // 70%+ dos filhos têm mesma assinatura?
        const dominant = sigs.reduce((acc, s) => acc.set(s, (acc.get(s) ?? 0) + 1), new Map<string, number>());
        const [topSig, topCount] = [...dominant.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
        if (topCount < 3 || topCount / children.length < 0.7) continue;

        // Evita listar o mesmo padrão duas vezes (container pai vs filho)
        if (seenSignatures.has(topSig)) continue;
        seenSignatures.add(topSig);

        // Pega só filhos que casam o topSig, e extrai texto
        const matching = children.filter((c) => sigOf(c) === topSig);
        const sampleRows = matching.slice(0, 15).map((c) => {
          const text = (c.innerText || "").trim().replace(/\s+/g, " ");
          // Divide por quebras de linha originais pra simular colunas
          const cells = text.split(/\s{2,}|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
          return cells.length > 0 ? cells : [text.slice(0, 200)];
        }).filter((r) => r.length > 0 && r[0]);

        if (sampleRows.length < 3) continue;

        out.push({
          headers: [`lista-virtual (${topCount} itens, padrão ${topSig})`],
          rowsPreview: sampleRows,
        });

        if (out.length >= 8) break;
      }

      return out;
    })
    .catch(() => [])) as PageTable[];

  return {
    url,
    title,
    visibleText: visibleText.slice(0, 8000),
    interactiveElements: interactiveElements.filter((e): e is PageInteractiveElement => !!e),
    links: links.filter((l) => !!l.href),
    tables: tables.length > 0 ? tables : undefined,
  };
}
