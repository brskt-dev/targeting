import type { PlannedAction } from "@targeting/shared";

// Ações proibidas no MVP. Qualquer plano que contenha uma destas é bloqueado.
// O kind de ação não é nominalmente "sendMessage" no nosso enum — então o
// guardrail também bloqueia clicks/types em padrões suspeitos.

const SUSPICIOUS_SELECTOR_PATTERNS = [
  /send[\s_-]?(message|btn|button)/i,
  /\bsubmit\b/i,
  /\bdelete\b/i,
  /\barchive\b/i,
  /\bblock\b/i,
  /\bfollow\b/i,
  /\bunfollow\b/i,
  /\bunlike\b/i,
  /^like$/i,
  /\bcomment\b/i,
  /\bpost\b/i,
  /\bpay\b/i,
];

const SUSPICIOUS_NAVIGATE_PATTERNS = [
  /\/logout/i,
  /\/sign-?out/i,
  /\/delete/i,
];

export type GuardrailResult = {
  allowed: boolean;
  reason?: string;
};

export function evaluateAction(action: PlannedAction): GuardrailResult {
  switch (action.kind) {
    case "click": {
      const hint = action.selectorHint ?? "";
      for (const pat of SUSPICIOUS_SELECTOR_PATTERNS) {
        if (pat.test(hint)) {
          return { allowed: false, reason: `click bloqueado: selector parece mutativo (${pat})` };
        }
      }
      return { allowed: true };
    }
    case "navigate":
    case "openInNewTab": {
      const url = action.kind === "navigate" ? action.url : action.url;
      for (const pat of SUSPICIOUS_NAVIGATE_PATTERNS) {
        if (pat.test(url)) {
          return { allowed: false, reason: `navegação bloqueada: ${pat}` };
        }
      }
      return { allowed: true };
    }
    case "scroll":
    case "goBack":
    case "wait":
    case "readText":
    case "extractLinks":
    case "closeTab":
    case "stop":
      return { allowed: true };
    default:
      return { allowed: true };
  }
}
