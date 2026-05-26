"use client";

import { useEffect, useRef } from "react";
import type { AgentLog, ScanRun, ContactCandidate, PlatformConnection } from "@targeting/shared";

export function DevPanel({
  connection,
  run,
  events,
  contacts,
}: {
  connection?: PlatformConnection;
  run?: ScanRun;
  events: AgentLog[];
  contacts: ContactCandidate[];
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card/50 p-3">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Conexão</h3>
        {connection ? (
          <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono">
{JSON.stringify({ id: connection.id, type: connection.type, status: connection.status, loginUrl: connection.loginUrl, platformDescription: connection.platformDescription, dataLocations: connection.dataLocations, knownQuirks: connection.knownQuirks }, null, 2)}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground">Nenhuma conexão selecionada.</div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card/50 p-3">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Run atual</h3>
        {run ? (
          <pre className="text-xs text-foreground/90 whitespace-pre-wrap font-mono">
{JSON.stringify(run, null, 2)}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground">Nenhum run em andamento ou selecionado.</div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Logs ao vivo (SSE)</h3>
          <span className="text-[10px] text-muted-foreground">{events.length} eventos</span>
        </div>
        <div ref={logRef} className="h-80 overflow-auto scroll-thin font-mono text-[11px] bg-background/60 rounded border border-border p-2">
          {events.length === 0 && <div className="text-muted-foreground">Aguardando eventos…</div>}
          {events.map((e) => (
            <div key={e.id} className="leading-relaxed">
              <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>{" "}
              <span className={levelColor(e.level)}>{e.event}</span>{" "}
              <span className="text-foreground/90">{e.message}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card/50 p-3">
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Contatos coletados ({contacts.length})</h3>
        <div className="overflow-auto scroll-thin max-h-80">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card/80 backdrop-blur">
              <tr>
                <th className="px-2 py-1 text-left font-normal">Nome</th>
                <th className="px-2 py-1 text-left font-normal">Telefone</th>
                <th className="px-2 py-1 text-left font-normal">Email</th>
                <th className="px-2 py-1 text-left font-normal">Origem</th>
                <th className="px-2 py-1 text-left font-normal">Evidências</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-2 py-1">{c.displayName ?? "—"}</td>
                  <td className="px-2 py-1">{c.phone ?? "—"}</td>
                  <td className="px-2 py-1">{(c.emails ?? []).join(", ") || "—"}</td>
                  <td className="px-2 py-1">{c.extractedFrom}</td>
                  <td className="px-2 py-1">{c.evidence.map((e) => e.type).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function levelColor(level: AgentLog["level"]): string {
  if (level === "error") return "text-destructive";
  if (level === "warn") return "text-amber-400";
  if (level === "debug") return "text-muted-foreground";
  return "text-emerald-400";
}
