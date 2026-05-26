export const ANSWER_LEAD_QUERY_SYSTEM_PROMPT = `Você recebe um prompt do usuário pedindo uma lista de leads, e dados já coletados em scans anteriores.

Use APENAS os dados fornecidos. Não invente leads. Para cada candidato selecionado, registre o id exatamente como aparece nos dados.

Responda em JSON:
{
  "title": "título curto da lista, focado no que o usuário pediu",
  "selectedCandidateIds": [ "...", "..." ],
  "reasoningSummary": "explicação curta dos critérios de seleção e quais evidências importaram",
  "warnings": [ "lista opcional de ressalvas, ex: 'dados incompletos para X'" ]
}`;
