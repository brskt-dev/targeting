# Targeting

Motor de descoberta de leads/targets para prospecção B2B e B2C.

Busca simultânea em múltiplas plataformas: Google Search, Google Maps, Instagram e LinkedIn — com exportação CSV.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14 (App Router) + Tailwind + shadcn/ui |
| Backend | Node.js + Fastify |
| Scraping | Playwright |
| Tipos | TypeScript compartilhado |
| Infra local | Docker + Docker Compose |

---

## Arquitetura

```
/apps
  /web        → Next.js (porta 3000)
  /api        → Fastify (porta 3001)

/packages
  /shared     → tipos Lead, SearchInput, SearchResponse, ProviderError, ScrapeEffort
  /scrapers   → registry de providers + pipeline de qualidade
    src/
      providers/          → google-search, google-maps, instagram, linkedin
      filters/            → profile-filter, location-filter, pipeline principal
      utils/              → google-search-runner (compartilhado)
      query-builder.ts    → queries por platform + targetType + scrapeEffort
      scorer.ts           → score por targetType
```

### Pipeline de coleta e qualidade

```
Usuário define: query + location + targetType + platforms + scrapeEffort
         ↓
API POST /search
         ↓
query-builder → queries específicas por (platform, targetType, scrapeEffort)
         ↓
Promise.allSettled([providerA, providerB, ...])  ← paralelo, falha isolada
         ↓
applyPostProcessing(raw, input):
  1. profile-filter → rejeita notícias, artigos, PDFs, vagas, sites acadêmicos
  2. scorer         → score 0–100 por targetType
  3. location-filter → ajuste ±20 por match de localização (token exato)
  4. profile bonus  → +15 para plataformas de perfil conhecidas
  5. dedup          → remove duplicatas por URL normalizada
  6. threshold      → descarta score ≤ 5, ordena desc
         ↓
{ results: Lead[], errors: ProviderError[] }
```

**Regra de produto: conteúdo não é lead.** Apenas perfis, negócios e contatos potenciais passam pelo filtro.

Cada provider é independente — falha de um não cancela os demais.

### Estratégia B2B vs B2C

#### Queries por `targetType` e `scrapeEffort`

**`targetType: "company"`**

| Platform | Query |
|---|---|
| `google_search` | `{query} {local}` |
| `google_maps` | `{query} {local}` |
| `instagram` | `site:instagram.com {query} {local}` |
| `linkedin` | `site:linkedin.com/company {query} {local}` |

**`targetType: "person"` — as queries mudam com o esforço**

| Esforço | google_search retorna |
|---|---|
| `fast` | `site:linkedin.com/in "{query}" "{local}"` |
| `balanced` | LinkedIn /in + broad com exclusões (-vagas -empresa -ltda ...) |
| `deep` | LinkedIn /in + broad + Instagram + GitHub |

Instagram e LinkedIn sempre usam `site:` específico + targetType (`/in` vs `/company`).  
Google Maps retorna vazio para `person` — Maps é de locais/negócios.

#### Filtros de qualidade

`filters/profile-filter.ts` — **hard reject** para não-contatos:
- Domínios bloqueados: G1, UOL, Estadão, Scielo, Glassdoor, Indeed, YouTube etc.
- Path patterns: `/noticias/`, `/artigo/`, `/blog/`, `/vagas/`, `.pdf`, `/wiki/` etc.
- Para person: rejeita `linkedin.com/company/`, `linkedin.com/jobs/`, `linkedin.com/pulse/`

`filters/location-filter.ts` — **match por token exato** (±20 no score):
- "americana" ≠ "americas", "american", "latin america"
- Normaliza acentos, separa tokens, exige igualdade estrita
- Não hard-rejeita perfis sem localização (muitos não expõem)

`scorer.ts` — **sinais positivos/negativos** por `targetType`:
- Person sobe com: `linkedin.com/in/`, `github.com/`, `portfólio`, `freelancer`, `developer`
- Person desce com: `ltda`, `vagas`, `campeonato`, `esports`, `americas`, `organização`

### Providers disponíveis

| Platform | Estratégia |
|---|---|
| `google_search` | Google Search via Playwright |
| `google_maps` | Google Maps via Playwright (company only) |
| `instagram` | Google `site:instagram.com` search (sem auth) |
| `linkedin` | Google `site:linkedin.com/in` ou `/company` (sem auth) |

> Instagram e LinkedIn usam Google como proxy de busca para evitar autenticação.

---

## Como rodar

### Pré-requisitos

- Node.js 20+
- pnpm 9+

### Desenvolvimento local

```bash
# Instalar dependências
pnpm install

# Instalar browser do Playwright
pnpm --filter @targeting/scrapers exec playwright install chromium

# Rodar tudo (web + api)
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Via Docker

```bash
docker compose up --build
```

---

## API

### POST /search

```bash
curl -X POST http://localhost:3001/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "clínicas de estética",
    "location": "Campinas",
    "targetType": "company",
    "platforms": ["google_maps", "instagram"],
    "scrapeEffort": "balanced"
  }'
```

**`scrapeEffort`** (opcional, padrão `"balanced"`): `"fast"` | `"balanced"` | `"deep"`

**Resposta:**
```json
{
  "results": [
    {
      "id": "uuid",
      "type": "company",
      "platform": "google_maps",
      "name": "Clínica X",
      "location": "Campinas, SP",
      "sourceUrl": "https://maps.google.com/...",
      "contact": { "phone": "(19) 99999-9999" }
    }
  ],
  "errors": [
    {
      "platform": "instagram",
      "message": "timeout"
    }
  ]
}
```

**Campos obrigatórios:** `query`, `targetType`, `platforms` (array não vazio)

**Plataformas válidas:** `google_search`, `google_maps`, `instagram`, `linkedin`

### GET /health

```bash
curl http://localhost:3001/health
# { "status": "ok" }
```

---

## Estrutura de dados

```ts
type Platform = "google_search" | "google_maps" | "instagram" | "linkedin";

type SearchInput = {
  query: string;
  location?: string;
  targetType: "person" | "company";
  platforms: Platform[];        // array multi-plataforma
};

type SearchResponse = {
  results: Lead[];
  errors: ProviderError[];      // providers que falharam, se houver
};
```

---

## Adicionando um novo provider

1. Criar `packages/scrapers/src/providers/meu-provider.provider.ts`:

```ts
import type { ScraperProvider } from "../types";

export const meuProvider: ScraperProvider = {
  platform: "minha_plataforma",
  async search(input) {
    // ... scraping aqui
    return leads;
  },
};
```

2. Adicionar ao tipo `Platform` em `packages/shared/src/types.ts`
3. Registrar em `packages/scrapers/src/providers/index.ts`

---

## Próximos passos

- [ ] Melhorar scraping direto do Instagram (explore/hashtags públicos)
- [ ] Melhorar scraping do LinkedIn (páginas públicas de company)
- [ ] Filtros avançados (segmento, tamanho, etc.)
- [ ] Score de relevância por lead
- [ ] Paginação de resultados
- [ ] Persistência opcional (SQLite)
- [ ] Autenticação simples
