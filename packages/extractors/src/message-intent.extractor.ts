// Classificação heurística leve para detectar intenção em textos de mensagens.
// Não substitui o LLM; serve para enriquecer evidência mesmo sem LLM disponível.

export type MessageIntent =
  | "asked_price"
  | "asked_schedule"
  | "asked_location"
  | "mentioned_interest"
  | "complaint"
  | "thanks"
  | "greeting"
  | "goodbye"
  | "unknown";

const PATTERNS: Array<{ intent: MessageIntent; re: RegExp }> = [
  { intent: "asked_price", re: /\b(pre[çc]o|quanto custa|valor|or[çc]amento|tabela|investimento)\b/i },
  { intent: "asked_schedule", re: /\b(agendar?|hor[áa]rio|marcar|disponibilidade|hor[áa]rios?)\b/i },
  { intent: "asked_location", re: /\b(endere[çc]o|onde fica|localiza[çc][ãa]o|como chego|fica onde)\b/i },
  { intent: "mentioned_interest", re: /\b(tenho interesse|quero saber|me interess[ae]i?|gostaria de saber)\b/i },
  { intent: "complaint", re: /\b(reclama[çc][ãa]o|reclamar|p[éessimo|terr[íi]vel|n[ãa]o gostei)\b/i },
  { intent: "thanks", re: /\b(obrigad[oa]|valeu|agrade[çc]o|grat[ao])\b/i },
  { intent: "greeting", re: /\b(ol[áa]|oi|bom dia|boa tarde|boa noite|e a[íi])\b/i },
  { intent: "goodbye", re: /\b(tchau|at[ée] mais|abra[çc]os?|abs|falou)\b/i },
];

export function detectIntents(text: string): MessageIntent[] {
  if (!text) return [];
  const out = new Set<MessageIntent>();
  for (const { intent, re } of PATTERNS) {
    if (re.test(text)) out.add(intent);
  }
  return Array.from(out);
}
