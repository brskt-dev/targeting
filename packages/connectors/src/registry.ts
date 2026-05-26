import type { PlatformKind } from "@targeting/shared";
import type { Connector } from "./types";
import { customWebConnector } from "./custom-web";

export const connectors: Record<PlatformKind, Connector> = {
  custom_web: customWebConnector,
};

export function getConnector(kind: PlatformKind): Connector {
  const c = connectors[kind];
  if (!c) throw new Error(`connector não suportado: ${kind}`);
  return c;
}
