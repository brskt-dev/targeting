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
  /shared     → tipos Lead, SearchInput, SearchResponse, ProviderError
  /scrapers   → registry de providers + implementações
```

### Multi-provider

```
Usuário seleciona plataformas [A, B, C]
         ↓
API recebe POST /search { platforms: ["google_maps", "instagram"] }
         ↓
Promise.allSettled([providerA.search(), providerB.search()])
         ↓
{ results: Lead[], errors: ProviderError[] }
         ↓
Tabela consolida todos os resultados + aviso se algum provider falhou
```

Cada provider é independente. Falha de um não cancela os demais.

### Providers disponíveis

| Platform | Estratégia |
|---|---|
| `google_search` | Google Search direto via Playwright |
| `google_maps` | Google Maps via Playwright |
| `instagram` | Google `site:instagram.com` search (sem auth) |
| `linkedin` | Google `site:linkedin.com/company` ou `/in` (sem auth) |

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
    "platforms": ["google_maps", "instagram"]
  }'
```

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
