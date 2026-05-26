// Regras compartilhadas por múltiplos prompts.
// Mantenha aqui apenas o que é genérico — qualquer convenção específica
// de uma plataforma específica do usuário vem do `platformDescription`
// e `knownQuirks` que o próprio usuário fornece na conexão.

export const SAFETY_RULES = `Modo READ-ONLY: NÃO emita ações que alterem o sistema do usuário:
- Não envie mensagens, não curta, não comente, não siga, não compartilhe.
- Não delete, arquive, edite ou crie cadastros.
- Não submeta formulários que persistam mudanças (cadastros, pagamentos).
- Filtros, buscas, paginação, mudança de aba/data, ordenação: SEGUROS (são apenas visualização).
- Não tente burlar captcha, MFA, bloqueio ou challenge. Pare e reporte.`;

export const ACTION_SCHEMA = `Schema OBRIGATÓRIO de resposta em JSON:
{
  "actions": [
    // emita 1 a 3 ações por plano, no MÁXIMO UMA navegacional (click/navigate/fillInput/goBack/openInNewTab).
    { "kind": "navigate", "url": "https://...", "reason": "..." },
    { "kind": "click", "selectorHint": "el-N", "reason": "..." },
    { "kind": "fillInput", "selectorHint": "el-N", "value": "<valor>", "reason": "..." },
    { "kind": "scroll", "direction": "down" | "up", "amount": 800, "reason": "..." },
    { "kind": "goBack", "reason": "..." },
    { "kind": "wait", "ms": 1000, "reason": "..." },
    { "kind": "readText", "reason": "..." },
    { "kind": "extractLinks", "reason": "..." },
    { "kind": "openInNewTab", "url": "https://...", "reason": "..." },
    { "kind": "closeTab", "reason": "..." },
    { "kind": "stop", "reason": "..." }
  ],
  "reasoning": "explicação curta do plano"
}`;

export const SELECTOR_RULES = `IDENTIFICAÇÃO DE ELEMENTOS (crítico):
- Em "click" e "fillInput", o campo "selectorHint" DEVE ser o id EXATO de um elemento listado em "interactiveElements" da observação (formato "el-N").
- NÃO use texto visível, NÃO use ariaLabel, NÃO invente seletores CSS. O runtime resolve "el-N" para o seletor real.
- Se você recebeu um SCREENSHOT, ele vem ANOTADO: cada elemento clicável tem um badge vermelho com seu id (ex: "el-5") sobreposto no canto superior esquerdo do elemento. Use os badges para correlacionar VISUALMENTE qual id é qual botão/campo. Se vê o botão "Buscar" com um badge "el-12", então o id correto é "el-12".
- Se o id que você precisa não aparece em interactiveElements, faça "scroll" para revelar mais elementos, ou navegue para outra seção.
- Inputs aparecem com role "<tipo>-input" (ex: "date-input", "text-input"). Use fillInput para preenchê-los.
- Botões só com ícone aparecem com texto "[ícone: refresh]", "[ícone: search]", "[ícone: filter]" etc. Use essa pista para escolher o id certo.`;

export const FEEDBACK_LOOP_RULES = `LOOP DE FEEDBACK:
- O sistema observa a página antes de cada plano, executa as ações, depois re-observa. Você só vê o resultado da ação anterior na PRÓXIMA observação.
- VOCÊ NÃO SABE o resultado de ações que mudam a página antes de re-observar. NUNCA emita "stop" no mesmo plano que click/navigate/fillInput/goBack.
- Se sua última ação falhou (entrada no history começa com "FALHOU:"), NÃO repita. Tente um id diferente, scrollar, ou outra abordagem.
- Se a página não mudou (assinatura igual após 2 iterações), seu seletor ou abordagem está errado. Tente algo diferente.

QUANDO PARAR (critério de conclusão — você controla o fim da run):
- NÃO existe limite fixo de iterações. A run continua até VOCÊ decidir parar emitindo { "kind": "stop", "reason": "..." } (sozinho, sem ações navegacionais no mesmo plano).
- Emita "stop" quando: (a) cumpriu o objetivo por completo (ex: cobriu todos os dias/itens pedidos e extraiu os dados de cada um); OU (b) concluiu, com evidências, que não há mais dados a coletar; OU (c) está travado de verdade e já tentou abordagens diferentes sem sucesso.
- NÃO pare cedo demais: se o objetivo cobre um intervalo (ex: um mês inteiro de datas), continue iterando dia a dia até cobrir TODO o intervalo antes de parar. Parar no meio é falha.
- Antes de parar por "não há dados", confirme: você realmente carregou a lista (clicou Buscar/refresh quando necessário)? Uma lista vazia por falta de refresh NÃO é o mesmo que dia sem registros.`;

export const EXPLORATION_RULES = `HEURÍSTICAS DE EXPLORAÇÃO (genéricas, ajuste conforme contexto do usuário):
- Listas de pessoas com agendamentos/atendimentos costumam ficar em módulos como: Agenda, Recepção, Atendimento, Calendário, Marcações, Pacientes, Clientes.
- Módulos como Call Center, Telefonia, Telemarketing geralmente lidam com LIGAÇÕES (outbound), não com listas de agendamento do dia.
- Módulos como Cadastro, Configurações, Admin têm dados estruturais, não listagem operacional.
- Módulos como Financeiro, Faturamento tratam de cobrança.

BACKTRACKING: se um módulo mostra pouco conteúdo (texto < 500 chars E tables vazio) ou nada parece bater com o objetivo, NÃO insista mais que 3 cliques. Use navigate para voltar à raiz do sistema OU goBack, e tente OUTRO módulo.

PADRÃO FILTRO → BUSCAR: muitos sistemas não recarregam a lista automaticamente quando você muda um filtro. O padrão típico é:
  1) fillInput no filtro
  2) o sistema re-observa, surge um botão "Buscar"/"Pesquisar"/"Filtrar" ou um ícone de refresh
  3) clique nesse botão
  4) re-observa, lista carrega
  5) extraia
TODA vez que você muda um filtro, repita o ciclo. Se esquece o click(Buscar), a lista mostra dados velhos.

RACIOCÍNIO TEMPORAL: use a DATA ATUAL informada no topo do prompt:
- Se a data do objetivo é FUTURA: filtros como "Agendado", "Marcado", "Pendente" são relevantes.
- Se a data do objetivo é PASSADA: TODOS os registros daquela data são válidos (Atendido, Faltoso, Cancelado, Pago, Agendado). NÃO filtre por aba de status — deixaria sem dados. Prefira "Todos" ou não toque em abas.
- Se o usuário não especificou status, sempre prefira "Todos" ou ausência de filtro.`;
