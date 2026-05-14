# Targeting

Motor de descoberta de leads/targets para prospecção B2B e B2C.

Encontre empresas, pessoas e perfis públicos via Google Search e Google Maps — com exportação CSV.

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
  /shared     → tipos Lead, SearchInput, SearchResponse
  /scrapers   → providers de scraping (google, maps)
```

**Fluxo:**
```
Usuário → web (formulário) → POST /search → api → scrapers → Lead[] → tabela + CSV
```

---

## Como rodar

### Pré-requisitos

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose (para rodar em container)

### Desenvolvimento local

```bash
# Instalar dependências
pnpm install

# Instalar browsers do Playwright
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
    "platform": "maps",
    "targetType": "company"
  }'
```

**Resposta:**
```json
{
  "results": [
    {
      "id": "uuid",
      "type": "company",
      "platform": "maps",
      "name": "Clínica X",
      "location": "Campinas, SP",
      "website": "https://...",
      "sourceUrl": "https://maps.google.com/...",
      "contact": { "phone": "(19) 99999-9999" }
    }
  ]
}
```

**Plataformas suportadas:**
- `google` — Google Search
- `maps` — Google Maps

**Campos obrigatórios:** `query`, `targetType`, `platform`

### GET /health

```bash
curl http://localhost:3001/health
# { "status": "ok" }
```

---

## Estrutura de dados

```ts
type Lead = {
  id: string;
  type: "person" | "company";
  platform: "google" | "maps" | "instagram" | "linkedin" | "website";
  name?: string;
  description?: string;
  website?: string;
  sourceUrl: string;
  location?: string;
  contact?: { email?: string; phone?: string; whatsapp?: string };
};
```

---

## Próximos passos

- [ ] Provider Instagram (perfis públicos)
- [ ] Provider LinkedIn (limitado a dados públicos)
- [ ] Filtros avançados (segmento, tamanho, etc.)
- [ ] Score de relevância por lead
- [ ] Paginação de resultados
- [ ] Persistência opcional (SQLite)
- [ ] Autenticação simples
