"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ContactCandidate,
  LeadList,
  PlatformConnection,
  ScanRun,
} from "@targeting/shared";
import { api } from "@/lib/api";
import { ConnectionSidebar } from "@/components/connection-sidebar";
import { ConnectionDialog, type ConnectionFormValues } from "@/components/connection-dialog";
import { ScanComposer } from "@/components/scan-composer";
import { EventMessage, SystemNotice, UserMessage, ThinkingMessage } from "@/components/event-message";
import { useAgentEvents } from "@/components/use-agent-events";
import { DevToggle } from "@/components/dev-toggle";
import { DevPanel } from "@/components/dev-panel";
import { useDevMode } from "@/components/dev-mode";
import { LeadsDrawer } from "@/components/leads-drawer";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  FileDown,
  Loader2,
  LogIn,
  MessageSquare,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";

const STORAGE_SELECTED = "targeting:selectedConnectionId";

type LeadQueryState = {
  prompt: string;
  loading: boolean;
  result?: LeadList;
  error?: string;
};

export default function HomePage() {
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [contacts, setContacts] = useState<ContactCandidate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [composerObjective, setComposerObjective] = useState<string | null>(null);
  const [drawerRunId, setDrawerRunId] = useState<string | null>(null);
  const [leadQuery, setLeadQuery] = useState<LeadQueryState>({ prompt: "", loading: false });

  const { devMode } = useDevMode();

  const selected = useMemo(
    () => connections.find((c) => c.id === selectedId),
    [connections, selectedId],
  );

  const events = useAgentEvents({
    connectionId: selected?.id,
    runId: activeRunId ?? undefined,
  });

  async function reload() {
    try {
      const [conns, allRuns, allContacts] = await Promise.all([
        api.listConnections(),
        api.listRuns(selectedId),
        api.listContacts(selectedId ? { connectionId: selectedId } : undefined),
      ]);
      setConnections(conns);
      setRuns(allRuns);
      setContacts(allContacts);
      const running = allRuns.find((r) => r.status === "running");
      if (running) setActiveRunId(running.id);
      else if (activeRunId && allRuns.find((r) => r.id === activeRunId && r.status !== "running")) {
        // mantém o id mas vamos parar de tratar como ativo
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    try {
      const sid = window.localStorage.getItem(STORAGE_SELECTED);
      if (sid) setSelectedId(sid);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedId) {
      try { window.localStorage.setItem(STORAGE_SELECTED, selectedId); } catch { /* ignore */ }
    }
  }, [selectedId]);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleCreate(v: ConnectionFormValues) {
    setBusy(true); setError(null);
    try {
      const c = await api.createConnection(v);
      setSelectedId(c.id);
      setDialogOpen(false);
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function handleEdit(v: ConnectionFormValues) {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await api.updateConnection(selected.id, v);
      setDialogOpen(false);
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function handleConnect() {
    if (!selected) return;
    try { await api.connect(selected.id); await reload(); }
    catch (e) { setError((e as Error).message); }
  }

  async function handleMarkConnected() {
    if (!selected) return;
    try { await api.markConnected(selected.id); await reload(); }
    catch (e) { setError((e as Error).message); }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Remover "${selected.name}"?`)) return;
    try {
      await api.deleteConnection(selected.id);
      setSelectedId(undefined);
      await reload();
    } catch (e) { setError((e as Error).message); }
  }

  async function handleStartScan(input: {
    objective: string;
    richInstructions?: string;
    useVision: boolean;
  }) {
    if (!selected) return;
    try {
      setError(null);
      setComposerObjective(input.objective);
      // depth vira teto de segurança no backend; "brutal" dá o teto mais alto
      // já que a run para sozinha ao concluir o objetivo.
      const run = await api.startScan(selected.id, { ...input, depth: "brutal" });
      setActiveRunId(run.id);
      await reload();
    } catch (e) { setError((e as Error).message); }
  }

  async function handleCancelScan() {
    if (!activeRunId) return;
    try { await api.cancelRun(activeRunId); await reload(); }
    catch (e) { setError((e as Error).message); }
  }

  async function handleDeleteRun(runId: string) {
    if (!confirm("Excluir esta run e todos os leads/evidências/logs dela?")) return;
    try {
      await api.deleteRun(runId);
      if (drawerRunId === runId) setDrawerRunId(null);
      if (activeRunId === runId) setActiveRunId(null);
      await reload();
    } catch (e) { setError((e as Error).message); }
  }

  async function handleLeadQuery() {
    if (!leadQuery.prompt.trim()) return;
    setLeadQuery((s) => ({ ...s, loading: true, error: undefined, result: undefined }));
    try {
      const list = await api.leadQuery({
        prompt: leadQuery.prompt.trim(),
        connectionIds: selected ? [selected.id] : undefined,
      });
      setLeadQuery((s) => ({ ...s, loading: false, result: list }));
    } catch (e) {
      setLeadQuery((s) => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }

  const currentRun = useMemo(
    () => runs.find((r) => r.id === activeRunId) ?? undefined,
    [runs, activeRunId],
  );

  return (
    <div className="flex h-screen">
      <ConnectionSidebar
        connections={connections}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => { setDialogMode("create"); setDialogOpen(true); }}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          connection={selected}
          onEdit={() => { setDialogMode("edit"); setDialogOpen(true); }}
          onDelete={handleDelete}
          onConnect={handleConnect}
          onMarkConnected={handleMarkConnected}
          onCancelScan={activeRunId && currentRun?.status === "running" ? handleCancelScan : undefined}
        />

        {error && (
          <div className="mx-6 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        {!selected ? (
          <EmptyState onNew={() => { setDialogMode("create"); setDialogOpen(true); }} />
        ) : devMode ? (
          <div className="flex-1 overflow-auto scroll-thin px-6 py-4">
            <DevPanel
              connection={selected}
              run={currentRun}
              events={events}
              contacts={contacts}
            />
          </div>
        ) : (
          <FriendlyView
            connection={selected}
            run={currentRun}
            runs={runs}
            contacts={contacts}
            events={events}
            composerObjective={composerObjective}
            onStartScan={handleStartScan}
            onOpenDrawer={setDrawerRunId}
            onDeleteRun={handleDeleteRun}
            leadQuery={leadQuery}
            onLeadQueryChange={(p) => setLeadQuery((s) => ({ ...s, prompt: p }))}
            onLeadQuerySubmit={handleLeadQuery}
          />
        )}
      </main>

      <ConnectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={dialogMode === "create" ? handleCreate : handleEdit}
        initial={dialogMode === "edit" ? selected : undefined}
        title={dialogMode === "create" ? "Nova plataforma" : "Editar plataforma"}
        submitting={busy}
      />

      <LeadsDrawer
        run={runs.find((r) => r.id === drawerRunId) ?? null}
        onClose={() => setDrawerRunId(null)}
      />
    </div>
  );
}

function TopBar({
  connection,
  onEdit,
  onDelete,
  onConnect,
  onMarkConnected,
  onCancelScan,
}: {
  connection?: PlatformConnection;
  onEdit: () => void;
  onDelete: () => void;
  onConnect: () => void;
  onMarkConnected: () => void;
  onCancelScan?: () => void;
}) {
  return (
    <header className="flex items-center gap-2 border-b border-border px-6 py-3">
      <div className="min-w-0 flex-1">
        {connection ? (
          <>
            <h1 className="text-sm font-semibold truncate">{connection.name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {connection.loginUrl} · <span className="capitalize">{connection.status.replace("_", " ")}</span>
            </p>
          </>
        ) : (
          <h1 className="text-sm font-semibold">Targeting</h1>
        )}
      </div>

      {connection && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={onConnect}>
            <LogIn className="h-3.5 w-3.5 mr-1" /> Conectar
          </Button>
          {connection.status !== "connected" && (
            <Button size="sm" variant="ghost" onClick={onMarkConnected}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Já logado
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onCancelScan && (
            <Button size="sm" variant="outline" onClick={onCancelScan}>
              Cancelar scan
            </Button>
          )}
        </div>
      )}

      <DevToggle />
    </header>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Conecte uma plataforma para começar</h2>
        <p className="text-sm text-muted-foreground">
          O Targeting abre o browser na URL da sua plataforma, você faz login manualmente, e depois pede em linguagem natural o que quer extrair.
        </p>
        <Button onClick={onNew}>Adicionar plataforma</Button>
      </div>
    </div>
  );
}

function FriendlyView({
  connection,
  run,
  runs,
  contacts,
  events,
  composerObjective,
  onStartScan,
  onOpenDrawer,
  onDeleteRun,
  leadQuery,
  onLeadQueryChange,
  onLeadQuerySubmit,
}: {
  connection: PlatformConnection;
  run?: ScanRun;
  runs: ScanRun[];
  contacts: ContactCandidate[];
  events: import("@targeting/shared").AgentLog[];
  composerObjective: string | null;
  onStartScan: (input: { objective: string; richInstructions?: string; useVision: boolean }) => void;
  onOpenDrawer: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  leadQuery: LeadQueryState;
  onLeadQueryChange: (v: string) => void;
  onLeadQuerySubmit: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);

  const isRunning = run?.status === "running";
  const contactsThisRun = run
    ? contacts.filter((c) => c.sourceRunId === run.id)
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-auto scroll-thin px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Histórico de scans anteriores (resumido) */}
          {runs.length > 0 && (
            <PreviousRunsSummary
              runs={runs}
              contacts={contacts}
              onOpenDrawer={onOpenDrawer}
              onDeleteRun={onDeleteRun}
            />
          )}

          {/* Conversa do run atual */}
          {run && (
            <div className="space-y-4">
              <UserMessage>
                <div className="space-y-1">
                  <div>{run.objective}</div>
                  {run.richInstructions && (
                    <div className="text-xs opacity-80 border-t border-primary-foreground/20 pt-1 mt-1">
                      {run.richInstructions}
                    </div>
                  )}
                </div>
              </UserMessage>

              <SystemNotice icon={Search}>
                Iniciei um scan <strong>{run.depth}</strong>
                {run.useVision ? " com vision" : ""}. Vou compartilhar os eventos abaixo.
              </SystemNotice>

              {events.length === 0 && isRunning && <ThinkingMessage />}
              {events.map((e) => <EventMessage key={e.id} log={e} />)}

              {run.status === "completed" && (
                <SystemNotice icon={CheckCircle2}>
                  Scan concluído. <strong>{contactsThisRun.length}</strong> contatos coletados nesta execução.
                  {" "}
                  <a className="text-primary underline" href={api.exportContactsUrl(run.id)}>Exportar CSV</a>
                </SystemNotice>
              )}

              {run.status === "cancelled" && (
                <SystemNotice icon={Search}>Scan cancelado pelo usuário.</SystemNotice>
              )}

              {run.status === "failed" && (
                <SystemNotice icon={Search}>Scan falhou. Veja o modo dev para o erro completo.</SystemNotice>
              )}
            </div>
          )}

          {!run && (
            <SystemNotice icon={composerObjective ? Loader2 : MessageSquare}>
              {composerObjective
                ? "Preparando seu scan…"
                : `Conexão "${connection.name}" pronta. Escreva abaixo o que você quer extrair.`}
            </SystemNotice>
          )}

          {/* Bloco de consulta por prompt (post-scan) */}
          {contacts.length > 0 && (
            <LeadQueryBlock
              state={leadQuery}
              contactsCount={contacts.length}
              onChange={onLeadQueryChange}
              onSubmit={onLeadQuerySubmit}
            />
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <ScanComposer disabled={isRunning} onSubmit={onStartScan} />
        </div>
      </div>
    </div>
  );
}

function PreviousRunsSummary({
  runs,
  contacts,
  onOpenDrawer,
  onDeleteRun,
}: {
  runs: ScanRun[];
  contacts: ContactCandidate[];
  onOpenDrawer: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
}) {
  const previous = runs.filter((r) => r.status !== "running");
  if (previous.length === 0) return null;
  const countByRun = new Map<string, number>();
  for (const c of contacts) countByRun.set(c.sourceRunId, (countByRun.get(c.sourceRunId) ?? 0) + 1);
  return (
    <details className="text-sm" open>
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Histórico de runs ({previous.length})
      </summary>
      <div className="mt-2 space-y-2">
        {previous.slice().reverse().map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card/40 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenDrawer(r.id)}
              className="min-w-0 text-left flex-1 hover:opacity-80"
              title="Abrir lista de leads desta run"
            >
              <div className="truncate text-foreground/90">{r.objective}</div>
              <div className="text-muted-foreground">
                {r.status} · {countByRun.get(r.id) ?? 0} leads · {r.startedAt && new Date(r.startedAt).toLocaleString()}
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenDrawer(r.id)}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Search className="h-3 w-3" /> Ver
              </button>
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href={api.exportContactsUrl(r.id)}
              >
                <FileDown className="h-3 w-3" /> CSV
              </a>
              <button
                type="button"
                onClick={() => onDeleteRun(r.id)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function LeadQueryBlock({
  state,
  contactsCount,
  onChange,
  onSubmit,
}: {
  state: LeadQueryState;
  contactsCount: number;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Consultar leads ({contactsCount} contatos coletados)
      </div>
      <div className="flex gap-2">
        <input
          value={state.prompt}
          onChange={(e) => onChange(e.target.value)}
          placeholder='Ex: "pacientes que vieram em abril e não pagaram"'
          className="flex-1 rounded-lg border border-input bg-input px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && state.prompt.trim()) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <Button onClick={onSubmit} disabled={state.loading || !state.prompt.trim()}>
          {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {state.error && (
        <div className="text-xs text-destructive">{state.error}</div>
      )}
      {state.result && (
        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{state.result.title}</div>
              <div className="text-xs text-muted-foreground">{state.result.candidates.length} leads</div>
            </div>
            <a
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              href={api.exportLeadListUrl(state.result.id)}
            >
              <FileDown className="h-3 w-3" /> Exportar CSV
            </a>
          </div>
          {state.result.reasoningSummary && (
            <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
              {state.result.reasoningSummary}
            </p>
          )}
          <ul className="text-xs space-y-1 max-h-48 overflow-auto scroll-thin">
            {state.result.candidates.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                <span className="truncate">{c.displayName ?? "(sem nome)"}</span>
                <span className="text-muted-foreground shrink-0">{c.phone ?? c.emails?.[0] ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
