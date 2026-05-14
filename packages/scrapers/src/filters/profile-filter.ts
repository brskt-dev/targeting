import type { Lead, TargetType } from "@targeting/shared";

// News, academic and aggregator domains — never valid leads
const BLOCKED_DOMAINS = [
  "wikipedia.org",
  "g1.globo.com",
  "globo.com",
  "uol.com.br",
  "terra.com.br",
  "estadao.com.br",
  "folha.uol.com.br",
  "techtudo.com.br",
  "canaltech.com.br",
  "olhardigital.com.br",
  "tecmundo.com.br",
  "infomoney.com.br",
  "exame.com",
  "valor.globo.com",
  "veja.abril.com.br",
  "r7.com",
  "ig.com.br",
  "cnn.com.br",
  "bbc.com",
  "bbc.co.uk",
  "techcrunch.com",
  "wired.com",
  "scielo.br",
  "scielo.org",
  "researchgate.net",
  "academia.edu",
  "jusbrasil.com.br",
  "glassdoor.com",
  "indeed.com",
  "catho.com.br",
  "vagas.com.br",
  "empregos.com.br",
  "infojobs.com.br",
  "youtube.com",
  "youtu.be",
];

// URL path segments that indicate editorial, academic or job content
const BLOCKED_PATH_SEGMENTS = [
  ".pdf",
  "/noticias/",
  "/noticia/",
  "/news/",
  "/artigo/",
  "/artigos/",
  "/article/",
  "/articles/",
  "/blog/",
  "/materia/",
  "/materias/",
  "/reportagem/",
  "/revista/",
  "/jornal/",
  "/wiki/",
  "/tcc/",
  "/monografia/",
  "/dissertacao/",
  "/dissertação/",
  "/tese/",
  "/scielo/",
  "/vagas/",
  "/jobs/",
  "/careers/",
  "/carreiras/",
  "/trabalhe-conosco/",
  "/category/",
  "/categorias/",
  "/tag/",
  "/tags/",
  "/feed/",
  "/amp/",
  "/search?",
];

// Profile platforms that are reliable for person results
const PERSON_PROFILE_PLATFORMS = [
  "linkedin.com/in/",
  "instagram.com/",
  "github.com/",
  "x.com/",
  "twitter.com/",
  "tiktok.com/@",
  "behance.net/",
  "dribbble.com/",
  "medium.com/@",
  "dev.to/",
];

// Profile platforms reliable for company results
const COMPANY_PROFILE_PLATFORMS = [
  "linkedin.com/company/",
  "instagram.com/",
  "facebook.com/",
  "maps.google.com/",
];

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function getFullUrlLower(url: string): string {
  return url.toLowerCase();
}

/**
 * Hard-rejects results that are clearly editorial, academic, or job-board content.
 * Returns false only when there is strong evidence the URL is NOT a contact/profile.
 * Errs on the side of keeping results when unsure.
 */
export function isContactLikeResult(lead: Lead, targetType: TargetType): boolean {
  const url = lead.profileUrl ?? lead.sourceUrl ?? lead.website ?? "";
  const domain = getDomain(url);
  const fullUrl = getFullUrlLower(url);

  // Reject known editorial/academic/job domains
  if (BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;

  // Reject by URL path patterns
  if (BLOCKED_PATH_SEGMENTS.some((seg) => fullUrl.includes(seg))) return false;

  // For person: reject LinkedIn non-profile paths
  if (targetType === "person") {
    if (fullUrl.includes("linkedin.com/company/")) return false;
    if (fullUrl.includes("linkedin.com/jobs/")) return false;
    if (fullUrl.includes("linkedin.com/school/")) return false;
    if (fullUrl.includes("linkedin.com/pulse/")) return false; // articles
  }

  return true;
}

/**
 * Returns true if the lead URL belongs to a well-known profile platform
 * for the given targetType. Used to give a score bonus.
 */
export function isKnownProfilePlatform(lead: Lead, targetType: TargetType): boolean {
  const url = (lead.profileUrl ?? lead.sourceUrl ?? lead.website ?? "").toLowerCase();
  const platforms =
    targetType === "person" ? PERSON_PROFILE_PLATFORMS : COMPANY_PROFILE_PLATFORMS;
  return platforms.some((p) => url.includes(p));
}
