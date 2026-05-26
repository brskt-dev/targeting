import type { PlatformConnection, ScanRun, ScanDepth } from "@targeting/shared";

export type ConnectorRunArgs = {
  connection: PlatformConnection;
  run: ScanRun;
  depth: ScanDepth;
  shouldStop?: () => boolean;
};

export type Connector = {
  type: PlatformConnection["type"];
  startUrl: string;
  // Abre o browser e verifica/aguarda login. Não tenta autenticar com credenciais.
  ensureLogin(args: { connection: PlatformConnection; shouldStop?: () => boolean }): Promise<void>;
  // Executa a varredura, persistindo dados durante a execução.
  runScan(args: ConnectorRunArgs): Promise<void>;
};

export type ScanCeiling = {
  safetyCeiling: number;
};

// Teto de SEGURANÇA por profundidade (não é o critério de parada — só evita
// loop infinito). A run para quando o agente conclui o objetivo (emite stop),
// erro, ou cancelamento. depth aqui só ajusta o quão longe deixamos ir antes
// de cortar à força.
export function ceilingFor(depth: ScanDepth): ScanCeiling {
  switch (depth) {
    case "fast": return { safetyCeiling: 60 };
    case "balanced": return { safetyCeiling: 150 };
    case "deep": return { safetyCeiling: 350 };
    case "brutal": return { safetyCeiling: 800 };
  }
}
