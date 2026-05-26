"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Send, Sparkles } from "lucide-react";

export function ScanComposer({
  disabled,
  onSubmit,
}: {
  disabled?: boolean;
  onSubmit: (input: {
    objective: string;
    richInstructions?: string;
    useVision: boolean;
  }) => void;
}) {
  const [objective, setObjective] = useState("");
  const [richInstructions, setRichInstructions] = useState("");
  const [useVision, setUseVision] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    onSubmit({
      objective: objective.trim(),
      richInstructions: richInstructions.trim() || undefined,
      useVision,
    });
    setObjective("");
    setRichInstructions("");
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/80 backdrop-blur shadow-lg">
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        placeholder='O que você quer extrair? Ex: "listar todos os pacientes agendados em abril de 2026"'
        className="w-full bg-transparent px-4 py-3 text-sm placeholder:text-muted-foreground/70 outline-none resize-none min-h-[72px] max-h-[200px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!disabled && objective.trim()) submit(e as unknown as React.FormEvent);
          }
        }}
      />

      {showAdvanced && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">
              Instruções detalhadas (caminho a seguir, dicas extras pra este scan)
            </label>
            <textarea
              value={richInstructions}
              onChange={(e) => setRichInstructions(e.target.value)}
              placeholder="Ex: Comece em /recepcao. Use o filtro de data, itere dia a dia de 01/04/2026 a 30/04/2026, clicando em Buscar após cada mudança. Deixe a aba em 'Todos'."
              className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-input/60 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <footer className="flex items-center gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showAdvanced ? "Esconder avançado" : "+ Instruções detalhadas"}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUseVision((v) => !v)}
            className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
              useVision
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Envia screenshots para o LLM em momentos críticos"
          >
            {useVision ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            Vision
          </button>

          <Button
            type="submit"
            size="sm"
            disabled={disabled || !objective.trim()}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Iniciar scan
          </Button>
        </div>
      </footer>

      <div className="px-4 pb-3 text-[11px] text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        Cmd/Ctrl + Enter para enviar
      </div>
    </form>
  );
}
