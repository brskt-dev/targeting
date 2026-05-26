"use client";

import { Code2, Sparkles } from "lucide-react";
import { useDevMode } from "./dev-mode";

export function DevToggle() {
  const { devMode, toggle } = useDevMode();
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      title={devMode ? "Modo dev ativo — clique para voltar ao modo amigável" : "Mostrar UI de desenvolvedor"}
    >
      {devMode ? (
        <>
          <Code2 className="h-3.5 w-3.5" />
          <span>Dev</span>
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          <span>Amigável</span>
        </>
      )}
    </button>
  );
}
