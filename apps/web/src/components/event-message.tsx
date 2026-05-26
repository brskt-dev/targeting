"use client";

import type { AgentLog } from "@targeting/shared";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Globe,
  Hand,
  Loader2,
  LogIn,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  UserPlus,
  XCircle,
} from "lucide-react";

const EVENT_META: Record<AgentLog["event"], { icon: React.ElementType; label: string; tone: "info" | "ok" | "warn" | "error" | "muted" }> = {
  connection_started: { icon: LogIn, label: "Conectando", tone: "info" },
  login_required: { icon: LogIn, label: "Login manual", tone: "info" },
  login_detected: { icon: CheckCircle2, label: "Sessão ativa", tone: "ok" },
  scan_started: { icon: Sparkles, label: "Scan iniciado", tone: "info" },
  page_observed: { icon: Eye, label: "Página observada", tone: "muted" },
  action_planned: { icon: Activity, label: "Plano", tone: "info" },
  action_executed: { icon: Hand, label: "Ação", tone: "muted" },
  contact_found: { icon: UserPlus, label: "Contato", tone: "ok" },
  conversation_found: { icon: UserPlus, label: "Conversa", tone: "ok" },
  message_extracted: { icon: UserPlus, label: "Mensagem", tone: "ok" },
  profile_found: { icon: UserPlus, label: "Perfil", tone: "ok" },
  evidence_added: { icon: CheckCircle2, label: "Evidência", tone: "ok" },
  custom_table_found: { icon: Globe, label: "Tabela detectada", tone: "info" },
  custom_record_found: { icon: UserPlus, label: "Registros extraídos", tone: "ok" },
  run_paused: { icon: Square, label: "Pausado", tone: "warn" },
  run_completed: { icon: CheckCircle2, label: "Concluído", tone: "ok" },
  run_failed: { icon: XCircle, label: "Falha", tone: "error" },
  challenge_detected: { icon: ShieldAlert, label: "Challenge", tone: "warn" },
  unsafe_action_blocked: { icon: AlertTriangle, label: "Ação bloqueada", tone: "warn" },
};

const TONE_STYLES: Record<"info" | "ok" | "warn" | "error" | "muted", string> = {
  info: "bg-primary/10 text-primary border-primary/30",
  ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  error: "bg-destructive/10 text-destructive-foreground border-destructive/40",
  muted: "bg-muted text-muted-foreground border-border",
};

export function EventMessage({ log }: { log: AgentLog }) {
  const meta = EVENT_META[log.event] ?? { icon: Activity, label: log.event, tone: "muted" as const };
  const Icon = meta.icon;
  return (
    <div className="flex gap-3 group">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${TONE_STYLES[meta.tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{meta.label}</span>
          <span>·</span>
          <span>{new Date(log.ts).toLocaleTimeString()}</span>
        </div>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground/90 break-words">
          {log.message}
        </div>
      </div>
    </div>
  );
}

export function ThinkingMessage() {
  return (
    <div className="flex gap-3 text-muted-foreground">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
      <div className="text-sm pt-1">Aguardando eventos do agente…</div>
    </div>
  );
}

export function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function SystemNotice({ children, icon: I = Search }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex gap-3 text-muted-foreground">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <I className="h-3.5 w-3.5" />
      </div>
      <div className="text-sm pt-1 leading-relaxed">{children}</div>
    </div>
  );
}
