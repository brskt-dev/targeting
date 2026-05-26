# Targeting

**Agente local-first para extrair leads de plataformas web autenticadas.**

O Targeting conecta-se a sistemas onde **você já tem acesso legítimo** — qualquer CRM, ERP, painel administrativo ou plataforma web — observa o ambiente com browser automation + LLM, extrai contatos/dados e responde prompts em linguagem natural do tipo *"monte uma lista de clientes que pediram orçamento e não fecharam"*.

UI dark, estilo chat. Eventos do agente aparecem como mensagens. Toggle "Dev" no topo direito mostra logs raw, run state e tabela de contatos para debug.

---

## O que ele faz

1. Você cadastra uma **plataforma** com URL, descrição, dicas de onde estão os dados e peculiaridades conhecidas. Esse contexto é injetado direto no system prompt do LLM.
2. O Targeting abre um **browser persistente local**. Você faz login manualmente — o app não pede nem guarda senha.
3. Você escreve em linguagem natural o que quer extrair (com instruções detalhadas opcionais).
4. O agente navega em modo *read-only*, observa páginas, opcionalmente envia screenshots ao LLM (modo Vision), e persiste contatos/evidências localmente em JSONL.
5. Depois você pode escrever **prompts pós-scan** para gerar listas filtradas, exportáveis em CSV.

### Princípio de acesso

- O Targeting **só trabalha com dados acessíveis à conta autenticada** pelo usuário.
- Não automatiza login com credenciais digitadas no app.
- Não tenta burlar captcha, MFA, challenge, bloqueio.
- **Não envia mensagens, não cria/edita/deleta dados, não submete formulários que persistam mudanças.** Apenas lê e filtra.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14 (App Router) + Tailwind, tema dark |
| Backend | Node.js + Fastify (SSE de eventos do agente) |
| Browser | Playwright (contexto persistente por conexão) |
| Persistência | JSONL append-only em `~/.targeting/` |
| LLM | OpenAI via `OPENAI_API_KEY` (default `gpt-4o-mini`). Suporta vision. |

---

## Arquitetura

```
apps/
  api/                  Fastify: /connections, /scan, /lead-query, /events (SSE), /export
  web/                  Next.js: dashboard chat-like + dev panel

packages/
  shared/               Tipos centrais (PlatformConnection, ScanRun, ContactCandidate, ...)
  storage/              JSONL stores + dedupe (contacts por telefone/nome)
  extractors/           Regex: email, phone, whatsapp, url, date, currency, message-intent
  agent/
    browser-agent.ts    Playwright headed + pool por conexão
    page-observer.ts    DOM compactado + listas virtuais + ícones
    task-runner.ts      Loop observe → plan → act, com stagnation guard
    guardrails.ts       Bloqueia ações mutativas
    llm-provider.ts     Abstração de LLM
    prompts/            Prompts organizados (plan-task, extract-data, etc.)
    providers/
      openai-llm.ts     OpenAI chat-completions com suporte a vision
  connectors/
    custom-web/         Único connector: qualquer sistema web autenticado
```

### Fluxo

```
Conexão (manual login)
   │
   ▼
Scan (objetivo + instruções + depth + vision)
   │
   ▼
Loop: observar → planejar (LLM) → agir → observar
   │
   ▼
Extração incremental (LLM) → JSONL + dedupe
   │
   ▼
Lead query pós-scan (LLM filtra dados coletados) → CSV
```

---

## UI

**Modo amigável (default):** sidebar com conexões à esquerda, chat na direita. Cada evento do agente vira uma mensagem com ícone (login, scan, plano, ação, contato, etc.). Composer no rodapé pra iniciar novos scans com objetivo + instruções detalhadas + depth + toggle vision.

**Modo dev:** toggle no topo direito mostra JSON cru da conexão, do run, logs SSE em fonte mono, e tabela de contatos brutos.

---

## Como ajudar o LLM a acertar o alvo

Quanto mais contexto, melhor. Ao criar/editar uma plataforma você pode preencher:

- **Descrição da plataforma** — que tipo de sistema é, módulos do menu, fluxo geral.
- **Onde estão os dados de interesse** — caminho mental para o agente seguir.
- **Peculiaridades** — quirks comportamentais (ex: "lista só recarrega após Buscar", "filtros submetam via Enter").

E ao iniciar um scan você tem:

- **Objetivo** (curto) — o quê.
- **Instruções detalhadas** (opcional, no expansor "+") — o como, intervalo de datas, abas a usar/evitar, etc.
- **Depth** — fast (8 iterações), balanced (18), deep (35), brutal (70).
- **Vision toggle** — envia screenshots ao LLM em cada plano. Custa mais tokens, mas ajuda muito quando o DOM compactado esconde info visual (ex: cor de status, ícones ambíguos). Ligado por padrão; sempre ativa em estagnação.

---

## Como rodar

### Pré-requisitos

- Node.js 20+
- pnpm 9+

### Setup

```bash
pnpm install
pnpm --filter @targeting/agent exec playwright install chromium
cp .env.example .env       # edite .env e cole sua OPENAI_API_KEY
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

### Variáveis de ambiente

| Variável | Obrigatório | Default | Descrição |
|---|---|---|---|
| `OPENAI_API_KEY` | sim | — | Chave da OpenAI. Fica só no backend. |
| `OPENAI_MODEL` | não | `gpt-4o-mini` | Modelo OpenAI usado. |
| `TARGETING_DATA_DIR` | não | `~/.targeting` | Diretório para JSONL e perfis de browser. |
| `CORS_ORIGIN` | não | `*` | Origem CORS aceita pela API. |
| `PORT` / `HOST` | não | `3001` / `0.0.0.0` | Porta e host da API. |
| `NEXT_PUBLIC_API_URL` | não | `http://localhost:3001` | URL da API usada pelo web. |

---

## Persistência

Tudo em `~/.targeting/` (ou `TARGETING_DATA_DIR`):

- `connections.jsonl`
- `runs.jsonl`
- `contacts.jsonl` (dedup automático por telefone, ou por nome quando ninguém tem telefone)
- `evidence.jsonl`
- `lead-lists.jsonl`
- `agent-logs.jsonl`
- `browser-profiles/<connectionId>/` — userDataDir do Playwright

---

## API

### Conexões
```
GET    /connections
POST   /connections                       { name, loginUrl, platformDescription?, dataLocations?, knownQuirks? }
PATCH  /connections/:id                   { name?, loginUrl?, platformDescription?, dataLocations?, knownQuirks? }
DELETE /connections/:id
POST   /connections/:id/connect           abre browser, aguarda login manual
POST   /connections/:id/mark-connected    força status connected (override)
POST   /connections/:id/open              só abre o browser
POST   /connections/:id/close             fecha contexto do browser
POST   /connections/:id/scan              { objective, richInstructions?, depth, useVision? }
```

### Runs / dados
```
GET    /runs?connectionId=...
GET    /runs/:id
POST   /runs/:id/cancel
GET    /contacts?runId=...|connectionId=...
GET    /evidence
GET    /logs?runId=...
GET    /lead-lists
```

### Lead query / export / SSE
```
POST   /lead-query                        { prompt, runIds?, connectionIds? }
GET    /export/contacts.csv?runId=...
GET    /export/lead-lists/:id.csv
GET    /events?connectionId=...&runId=... SSE de AgentLog
```

---

## Prompts

Toda string de prompt vive em [packages/agent/src/prompts/](packages/agent/src/prompts/), separada do código:

- `shared.ts` — regras genéricas (safety, schema, selectors, feedback loop, exploration, raciocínio temporal)
- `plan-task.ts` — system prompt do planner. Compõe regras + contexto da conexão + instruções do usuário.
- `extract-data.ts` — extração de dados estruturados.
- `interpret-page.ts` — classificação rápida da tela.
- `answer-lead-query.ts` — lead query pós-scan.

As regras são **genéricas** — qualquer convenção específica de uma plataforma sua vira contexto que o próprio usuário fornece na conexão (`platformDescription`, `dataLocations`, `knownQuirks`).

---

## Legacy

O código antigo de scraping público está em `packages/scrapers` mas não é wirado por padrão. `POST /search` na API responde 410. Os tipos antigos seguem disponíveis em `@targeting/shared/Legacy` (namespace) caso queira referenciar.
