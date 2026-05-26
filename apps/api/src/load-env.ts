import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Carrega .env de duas localizações em ordem: raiz do repo (preferida) e apps/api/.env.
// Variáveis já existentes no ambiente vencem (não sobrescrevemos).
const candidates = [
  resolve(__dirname, "../../../.env"),
  resolve(__dirname, "../.env"),
];

for (const path of candidates) {
  if (existsSync(path)) {
    dotenvConfig({ path, override: false });
  }
}
