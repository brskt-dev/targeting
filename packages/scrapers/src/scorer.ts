import type { Lead, TargetType } from "@targeting/shared";

// Signals that strongly suggest corporate, institutional or non-person content
const COMPANY_SIGNALS = [
  "ltda",
  "eireli",
  " s.a",
  "s/a",
  "software house",
  "consultoria",
  "agência",
  "agencia",
  "soluções",
  "solucoes",
  "serviços",
  "servicos",
  "/company/",
  "jobs/",
  "careers",
  "vagas",
  " vaga ",
  "recrutamento",
  "hiring",
  "banco de talentos",
  "trabalhe conosco",
  "corp.",
  " corp ",
  // Events, championships and organisations — not individual contacts
  "championship",
  "campeonato",
  "torneio",
  "tournament",
  "liga ",
  " league",
  "oficial",
  "official",
  "organização",
  "organization",
  "comunidade",
  "community",
  "evento ",
  " event ",
  "americas ", // "vct americas", "latin americas", etc. — distinct from "americana"
  "esports",
  "gaming",
];

// Signals that suggest an individual person/professional profile
const PERSON_SIGNALS = [
  "linkedin.com/in/",
  "github.com/",
  "portfolio",
  "portfólio",
  "portifolio",
  "curriculo",
  "currículo",
  "freelancer",
  "desenvolvedor",
  "developer",
  "software engineer",
  "engenheiro",
  "designer",
  "founder",
  "criador",
  "creator",
  "profissional",
  "consultor independente",
  "instagram.com/",
];

export function scoreLeadForTargetType(lead: Lead, targetType: TargetType): number {
  const text = [lead.name, lead.description, lead.sourceUrl, lead.profileUrl, lead.website]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 50;

  if (targetType === "person") {
    for (const signal of COMPANY_SIGNALS) {
      if (text.includes(signal)) score -= 15;
    }
    for (const signal of PERSON_SIGNALS) {
      if (text.includes(signal)) score += 20;
    }
  } else {
    for (const signal of COMPANY_SIGNALS) {
      if (text.includes(signal)) score += 8;
    }
    for (const signal of ["linkedin.com/in/", "github.com/", "curriculo", "currículo"]) {
      if (text.includes(signal)) score -= 10;
    }
  }

  return Math.max(0, Math.min(100, score));
}
