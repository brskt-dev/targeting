import type { PlatformConnection } from "@targeting/shared";
import { JsonlStore } from "./jsonl-store";

const store = new JsonlStore<PlatformConnection>("connections.jsonl");

export function listConnections(): PlatformConnection[] {
  return store.all();
}

export function getConnection(id: string): PlatformConnection | undefined {
  return store.byId(id);
}

export function saveConnection(conn: PlatformConnection): PlatformConnection {
  store.update({ ...conn, updatedAt: new Date().toISOString() });
  return conn;
}

export function deleteConnection(id: string): void {
  store.delete(id);
}
