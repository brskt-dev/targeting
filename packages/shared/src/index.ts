export * from "./types";
// Tipos legados ainda exportados no topo para compat do pacote legado @targeting/scrapers.
// Não há colisão de nomes com os novos tipos.
export * from "./legacy";
// Também disponível como namespace explícito.
export * as Legacy from "./legacy";
