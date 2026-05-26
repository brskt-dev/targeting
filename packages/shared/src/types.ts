// Tipos centrais do NOVO Targeting.
// Plataformas autenticadas, agente de extração, persistência local.

// Foco do MVP: plataformas web autenticadas do usuário.
// Mantido como union para permitir futuras adições sem refactor amplo.
export type PlatformKind = "custom_web";

export type ConnectionStatus =
  | "not_connected"
  | "connected"
  | "expired"
  | "blocked"
  | "error";

export type PlatformConnection = {
  id: string;
  type: PlatformKind;
  name: string;
  status: ConnectionStatus;
  loginUrl?: string;
  userDataDir?: string;
  // Contexto que o usuário fornece sobre a plataforma para ajudar o LLM:
  // - platformDescription: texto livre descrevendo o sistema (ex: "CRM clínico, agenda em /recepcao")
  // - dataLocations: dicas sobre onde estão os dados de interesse
  // - knownQuirks: peculiaridades comportamentais (ex: "lista só carrega após Buscar")
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScanDepth = "fast" | "balanced" | "deep" | "brutal";

export type ScanRunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ScanMetrics = {
  pagesObserved?: number;
  contactsFound?: number;
  conversationsFound?: number;
  messagesExtracted?: number;
  evidenceAdded?: number;
  errors?: number;
};

export type AgentLogLevel = "info" | "warn" | "error" | "debug";

export type AgentLogEventType =
  | "connection_started"
  | "login_required"
  | "login_detected"
  | "scan_started"
  | "page_observed"
  | "action_planned"
  | "action_executed"
  | "contact_found"
  | "conversation_found"
  | "message_extracted"
  | "profile_found"
  | "evidence_added"
  | "custom_table_found"
  | "custom_record_found"
  | "run_paused"
  | "run_completed"
  | "run_failed"
  | "challenge_detected"
  | "unsafe_action_blocked";

export type AgentLog = {
  id: string;
  runId?: string;
  connectionId?: string;
  ts: string;
  level: AgentLogLevel;
  event: AgentLogEventType;
  message: string;
  data?: Record<string, unknown>;
};

export type ScanRun = {
  id: string;
  connectionId: string;
  platform: PlatformKind;
  // O objetivo "curto" — quem o usuário quer extrair
  objective: string;
  // Instruções ricas opcionais — caminho/rota a seguir, dicas, restrições
  // específicas dessa execução (ex: "começar em /recepcao, iterar do dia X ao Y")
  richInstructions?: string;
  depth: ScanDepth;
  // Permite o usuário ativar/desativar uso de screenshots no planner LLM
  useVision?: boolean;
  status: ScanRunStatus;
  startedAt?: string;
  finishedAt?: string;
  metrics?: ScanMetrics;
};

export type ContactKind = "person" | "business" | "group" | "unknown";

export type ExtractedFrom =
  | "whatsapp_chat"
  | "instagram_dm"
  | "instagram_follower"
  | "instagram_following"
  | "instagram_comment"
  | "instagram_like"
  | "instagram_profile"
  | "custom_table"
  | "custom_card"
  | "custom_detail_page"
  | "custom_message"
  | "custom_unknown";

export type EvidenceType =
  | "message_sent"
  | "message_received"
  | "conversation_started"
  | "conversation_abandoned"
  | "asked_price"
  | "asked_schedule"
  | "asked_location"
  | "mentioned_interest"
  | "liked_post"
  | "commented_post"
  | "follows_account"
  | "is_follower"
  | "is_following"
  | "appointment_created"
  | "appointment_missed"
  | "appointment_cancelled"
  | "status_found"
  | "table_row_found"
  | "profile_field_found"
  | "contact_field_found"
  | "custom_observation";

export type Evidence = {
  id: string;
  type: EvidenceType;
  value?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  timestamp?: string;
  confidence?: number;
  raw?: Record<string, unknown>;
};

export type ContactCandidate = {
  id: string;
  platform: PlatformKind;
  sourceConnectionId: string;
  sourceRunId: string;
  kind: ContactKind;
  displayName?: string;
  username?: string;
  phone?: string;
  emails?: string[];
  profileUrl?: string;
  avatarUrl?: string;
  website?: string;
  sourceUrls?: string[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  extractedFrom: ExtractedFrom;
  rawData?: Record<string, unknown>;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
};

export type MessageDirection = "inbound" | "outbound" | "unknown";

export type Attachment = {
  type: string;
  label?: string;
  url?: string;
};

export type Message = {
  id: string;
  conversationId: string;
  platform: PlatformKind;
  direction: MessageDirection;
  senderName?: string;
  text?: string;
  sentAt?: string;
  attachments?: Attachment[];
  rawData?: Record<string, unknown>;
};

export type Conversation = {
  id: string;
  platform: PlatformKind;
  connectionId: string;
  runId: string;
  contactCandidateId?: string;
  title?: string;
  sourceUrl?: string;
  lastMessageAt?: string;
  messagesCount?: number;
  rawData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type LeadList = {
  id: string;
  title: string;
  prompt: string;
  sourceRunIds: string[];
  candidates: ContactCandidate[];
  reasoningSummary?: string;
  warnings?: string[];
  createdAt: string;
};

// ============================================================
// Eventos do agente (live logs via SSE)
// ============================================================

export type AgentEvent = AgentLog;

// ============================================================
// Page observation
// ============================================================

export type PageInteractiveElement = {
  id: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  selectorHint?: string;
};

export type PageLink = {
  text?: string;
  href: string;
};

export type PageTable = {
  headers: string[];
  rowsPreview: string[][];
};

export type PageObservation = {
  url: string;
  title?: string;
  visibleText: string;
  interactiveElements: PageInteractiveElement[];
  links: PageLink[];
  tables?: PageTable[];
  screenshotPath?: string;
};

// ============================================================
// LLM Provider
// ============================================================

export type PlanTaskInput = {
  platform: PlatformKind;
  objective: string;
  richInstructions?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
  pageObservation?: PageObservation;
  screenshotBase64?: string;
  history?: string[];
};

export type PlannedAction =
  | { kind: "navigate"; url: string; reason: string }
  | { kind: "click"; selectorHint: string; reason: string }
  | { kind: "fillInput"; selectorHint: string; value: string; reason: string }
  | { kind: "scroll"; direction: "down" | "up"; amount?: number; reason: string }
  | { kind: "goBack"; reason: string }
  | { kind: "wait"; ms: number; reason: string }
  | { kind: "readText"; reason: string }
  | { kind: "extractLinks"; reason: string }
  | { kind: "openInNewTab"; url: string; reason: string }
  | { kind: "closeTab"; reason: string }
  | { kind: "stop"; reason: string };

export type TaskPlan = {
  actions: PlannedAction[];
  reasoning: string;
};

export type InterpretPageInput = {
  observation: PageObservation;
  platform: PlatformKind;
  objective: string;
};

export type PageInterpretation = {
  summary: string;
  hints: {
    looksLikeList?: boolean;
    looksLikeDetail?: boolean;
    looksLikeChat?: boolean;
    looksLikeLogin?: boolean;
    looksLikeChallenge?: boolean;
  };
};

export type ExtractStructuredDataInput = {
  observation: PageObservation;
  platform: PlatformKind;
  extractKind:
    | "contact"
    | "conversation"
    | "messages"
    | "table_rows"
    | "profile";
  hints?: Record<string, unknown>;
  // Quando presente, o extractor recebe screenshot da página atual para
  // identificar visualmente registros (linhas, cards, etc.).
  screenshotBase64?: string;
};

export type ExtractedField = {
  key: string;
  value: string;
  sourceLabel?: string;
  confidence?: number;
};

export type ExtractedData = {
  records: Array<{
    fields: ExtractedField[];
    raw?: Record<string, unknown>;
  }>;
};

export type AnswerLeadQueryInput = {
  prompt: string;
  candidates: ContactCandidate[];
  conversations?: Conversation[];
  messages?: Message[];
};

export type LeadListDraft = {
  title: string;
  selectedCandidateIds: string[];
  reasoningSummary: string;
  warnings?: string[];
};
