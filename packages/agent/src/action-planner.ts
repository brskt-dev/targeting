import type { PlannedAction, PlatformKind, PageObservation } from "@targeting/shared";
import { getLlmProvider } from "./llm-provider";

export async function planNextActions(args: {
  platform: PlatformKind;
  objective: string;
  observation: PageObservation;
  richInstructions?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
  screenshotBase64?: string;
  history?: string[];
}): Promise<{ actions: PlannedAction[]; reasoning: string }> {
  const llm = getLlmProvider();
  return llm.planTask({
    platform: args.platform,
    objective: args.objective,
    richInstructions: args.richInstructions,
    platformDescription: args.platformDescription,
    dataLocations: args.dataLocations,
    knownQuirks: args.knownQuirks,
    pageObservation: args.observation,
    screenshotBase64: args.screenshotBase64,
    history: args.history,
  });
}
