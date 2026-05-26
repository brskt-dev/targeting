"use client";

import type { PlatformConnection } from "@targeting/shared";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectionSidebar({
  connections,
  selectedId,
  onSelect,
  onNew,
}: {
  connections: PlatformConnection[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card/40 flex flex-col h-screen">
      <header className="px-4 py-4 flex items-center gap-2 border-b border-border">
        <Target className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Targeting</span>
      </header>

      <div className="px-3 py-3">
        <Button
          onClick={onNew}
          size="sm"
          className="w-full justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova plataforma
        </Button>
      </div>

      <nav className="flex-1 overflow-auto scroll-thin px-2 pb-4 space-y-1">
        {connections.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">
            Nenhuma plataforma conectada. Comece adicionando uma.
          </div>
        )}
        {connections.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60 text-foreground/80"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{c.name}</span>
                <StatusDot status={c.status} />
              </div>
              {c.loginUrl && (
                <div className="mt-0.5 text-xs text-muted-foreground truncate">
                  {c.loginUrl.replace(/^https?:\/\//, "")}
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function StatusDot({ status }: { status: PlatformConnection["status"] }) {
  const color =
    status === "connected" ? "bg-emerald-500" :
    status === "error" || status === "blocked" ? "bg-destructive" :
    status === "expired" ? "bg-amber-500" :
    "bg-muted-foreground/50";
  return <span className={`h-2 w-2 rounded-full ${color}`} title={status} />;
}
