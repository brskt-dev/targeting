import type {
  PlanTaskInput,
  TaskPlan,
  InterpretPageInput,
  PageInterpretation,
  ExtractStructuredDataInput,
  ExtractedData,
  AnswerLeadQueryInput,
  LeadListDraft,
} from "@targeting/shared";

export interface LlmProvider {
  planTask(input: PlanTaskInput): Promise<TaskPlan>;
  interpretPage(input: InterpretPageInput): Promise<PageInterpretation>;
  extractStructuredData(input: ExtractStructuredDataInput): Promise<ExtractedData>;
  answerLeadQuery(input: AnswerLeadQueryInput): Promise<LeadListDraft>;
}

let activeProvider: LlmProvider | null = null;

export function setLlmProvider(p: LlmProvider): void {
  activeProvider = p;
}

export function getLlmProvider(): LlmProvider {
  if (!activeProvider) {
    throw new Error(
      "Nenhum LlmProvider configurado. Chame setLlmProvider() na inicialização da API.",
    );
  }
  return activeProvider;
}
