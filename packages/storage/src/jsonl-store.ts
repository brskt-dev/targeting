import { appendFileSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileFor } from "./paths";

// Pequena store append-only baseada em JSONL.
// Cada arquivo guarda registros de UM tipo.
// Update = append do registro novo com o mesmo id; ao ler, último por id vence.
// Delete = append com __deleted: true.

type Row<T> = T & { id: string; __deleted?: boolean };

export class JsonlStore<T extends { id: string }> {
  private readonly path: string;

  constructor(filename: string) {
    this.path = fileFor(filename);
    if (!existsSync(this.path)) {
      writeFileSync(this.path, "");
    }
  }

  append(record: T): void {
    appendFileSync(this.path, JSON.stringify(record) + "\n", "utf8");
  }

  update(record: T): void {
    this.append(record);
  }

  delete(id: string): void {
    this.append({ id, __deleted: true } as unknown as T);
  }

  // Apaga (tombstone) todos os registros que casam o predicado. Retorna quantos.
  deleteWhere(predicate: (row: T) => boolean): number {
    const toDelete = this.all().filter(predicate);
    for (const row of toDelete) {
      this.append({ id: row.id, __deleted: true } as unknown as T);
    }
    return toDelete.length;
  }

  all(): T[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, "utf8");
    if (!raw) return [];
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const byId = new Map<string, Row<T>>();
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as Row<T>;
        byId.set(row.id, row);
      } catch {
        // ignora linha corrompida
      }
    }
    return Array.from(byId.values()).filter((r) => !r.__deleted) as T[];
  }

  byId(id: string): T | undefined {
    return this.all().find((r) => r.id === id);
  }

  filter(predicate: (row: T) => boolean): T[] {
    return this.all().filter(predicate);
  }
}
