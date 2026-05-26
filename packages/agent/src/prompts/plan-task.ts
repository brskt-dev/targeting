import {
  ACTION_SCHEMA,
  EXPLORATION_RULES,
  FEEDBACK_LOOP_RULES,
  SAFETY_RULES,
  SELECTOR_RULES,
} from "./shared";

export type PlanTaskPromptContext = {
  currentDate: string;
  userObjective: string;
  richInstructions?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
};

export function planTaskSystemPrompt(ctx: PlanTaskPromptContext): string {
  const sections: string[] = [
    `Você é um agente que navega plataformas web autenticadas para coletar dados, em modo READ-ONLY.
Trabalha em ciclos: observar a página → planejar 1-3 ações → executar → observar de novo.
A resposta DEVE ser JSON válido.

DATA ATUAL DO SISTEMA: ${ctx.currentDate}`,
  ];

  sections.push(`\nOBJETIVO DO USUÁRIO (prioridade máxima):
${ctx.userObjective}`);

  if (ctx.richInstructions?.trim()) {
    sections.push(`\nINSTRUÇÕES DETALHADAS DO USUÁRIO:
${ctx.richInstructions.trim()}`);
  }

  if (ctx.platformDescription?.trim()) {
    sections.push(`\nDESCRIÇÃO DA PLATAFORMA (fornecida pelo usuário):
${ctx.platformDescription.trim()}`);
  }

  if (ctx.dataLocations?.trim()) {
    sections.push(`\nONDE OS DADOS COSTUMAM ESTAR (dica do usuário):
${ctx.dataLocations.trim()}`);
  }

  if (ctx.knownQuirks?.trim()) {
    sections.push(`\nPECULIARIDADES CONHECIDAS DESTA PLATAFORMA (dica do usuário):
${ctx.knownQuirks.trim()}`);
  }

  sections.push(`\n${ACTION_SCHEMA}`);
  sections.push(`\n${SAFETY_RULES}`);
  sections.push(`\n${SELECTOR_RULES}`);
  sections.push(`\n${FEEDBACK_LOOP_RULES}`);
  sections.push(`\n${EXPLORATION_RULES}`);

  return sections.join("\n");
}
