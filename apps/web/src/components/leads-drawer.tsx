"use client";

import { useEffect, useState } from "react";
import type { ContactCandidate, ScanRun } from "@targeting/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, X } from "lucide-react";

export function LeadsDrawer({
  run,
  onClose,
}: {
  run: ScanRun | null;
  onClose: () => void;
}) {
  const [contacts, setContacts] = useState<ContactCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!run) return;
    setLoading(true);
    api.listContacts({ runId: run.id })
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [run]);

  if (!run) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl border-l border-border bg-card shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{run.objective}</h2>
            <p className="text-xs text-muted-foreground">
              {run.status} · {run.startedAt && new Date(run.startedAt).toLocaleString()} · {contacts.length} leads
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={api.exportContactsUrl(run.id)}>
              <Button size="sm" variant="outline" className="gap-1">
                <FileDown className="h-3.5 w-3.5" /> CSV
              </Button>
            </a>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto scroll-thin">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-5 py-16 text-center text-sm text-muted-foreground">
              Nenhum lead coletado nesta run.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {contacts.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.displayName ?? "(sem nome)"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.phone, ...(c.emails ?? [])].filter(Boolean).join(" · ") || "sem contato"}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{c.extractedFrom}</span>
                  </div>
                  {c.evidence.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.evidence.slice(0, 6).map((e) => (
                        <span key={e.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {e.type}{e.value ? `: ${e.value.slice(0, 24)}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
