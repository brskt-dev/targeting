import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const DEFAULT_DIR = join(homedir(), ".targeting");

export function dataDir(): string {
  const dir = process.env.TARGETING_DATA_DIR ?? DEFAULT_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function fileFor(name: string): string {
  return join(dataDir(), name);
}

export function browserProfileDir(connectionId: string): string {
  const dir = join(dataDir(), "browser-profiles", connectionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function evidenceDir(): string {
  const dir = join(dataDir(), "evidence");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
