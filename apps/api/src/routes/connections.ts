import type { FastifyInstance } from "fastify";
import type { PlatformConnection, PlatformKind } from "@targeting/shared";
import {
  listConnections,
  getConnection,
  saveConnection,
  deleteConnection,
} from "@targeting/storage";
import { getConnector } from "@targeting/connectors";
import { getOrCreateAgent, disposeAgent, log } from "@targeting/agent";
import { randomUUID } from "node:crypto";

const VALID_PLATFORMS: PlatformKind[] = ["custom_web"];

// Flags p/ interromper o loop de ensureLogin em curso quando o usuário marca
// manualmente como conectado pelo dashboard.
const loginStopFlags = new Map<string, boolean>();

type CreateConnectionBody = {
  type?: PlatformKind;
  name: string;
  loginUrl?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
};

type UpdateConnectionBody = {
  name?: string;
  loginUrl?: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
};

export async function connectionsRoutes(app: FastifyInstance) {
  app.get("/connections", async () => ({ connections: listConnections() }));

  app.get<{ Params: { id: string } }>("/connections/:id", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });
    return { connection: c };
  });

  app.post<{ Body: CreateConnectionBody }>("/connections", async (req, reply) => {
    const body = req.body ?? ({} as CreateConnectionBody);
    const type: PlatformKind = body.type ?? "custom_web";
    if (!VALID_PLATFORMS.includes(type)) {
      return reply.status(400).send({ error: `type inválido. Use ${VALID_PLATFORMS.join(", ")}` });
    }
    if (!body.name || typeof body.name !== "string") {
      return reply.status(400).send({ error: "name obrigatório" });
    }
    if (!body.loginUrl || !/^https?:\/\//i.test(body.loginUrl)) {
      return reply.status(400).send({ error: "loginUrl obrigatória (http/https)" });
    }

    const now = new Date().toISOString();
    const conn: PlatformConnection = {
      id: randomUUID(),
      type,
      name: body.name,
      status: "not_connected",
      loginUrl: body.loginUrl,
      platformDescription: body.platformDescription,
      dataLocations: body.dataLocations,
      knownQuirks: body.knownQuirks,
      createdAt: now,
      updatedAt: now,
    };
    saveConnection(conn);
    return reply.status(201).send({ connection: conn });
  });

  app.patch<{ Params: { id: string }; Body: UpdateConnectionBody }>(
    "/connections/:id",
    async (req, reply) => {
      const c = getConnection(req.params.id);
      if (!c) return reply.status(404).send({ error: "not found" });
      const body = req.body ?? ({} as UpdateConnectionBody);
      const updated: PlatformConnection = {
        ...c,
        name: body.name ?? c.name,
        loginUrl: body.loginUrl ?? c.loginUrl,
        platformDescription: body.platformDescription ?? c.platformDescription,
        dataLocations: body.dataLocations ?? c.dataLocations,
        knownQuirks: body.knownQuirks ?? c.knownQuirks,
        updatedAt: new Date().toISOString(),
      };
      saveConnection(updated);
      return { connection: updated };
    },
  );

  app.delete<{ Params: { id: string } }>("/connections/:id", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });
    await disposeAgent(c.id).catch(() => {});
    deleteConnection(c.id);
    return { ok: true };
  });

  // Abre o browser persistente e dispara a checagem de login.
  // Roda em segundo plano; o cliente pode acompanhar via /events?connectionId=...
  app.post<{ Params: { id: string } }>("/connections/:id/connect", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });

    const connector = getConnector(c.type);
    saveConnection({ ...c, status: "not_connected" });
    loginStopFlags.set(c.id, false);
    log({ connectionId: c.id }, "info", "connection_started",
      `Abrindo sessão para ${c.name} (${c.type})`);

    // dispara em background
    (async () => {
      try {
        await connector.ensureLogin({
          connection: c,
          shouldStop: () => loginStopFlags.get(c.id) === true,
        });
        saveConnection({ ...c, status: "connected" });
      } catch (err) {
        saveConnection({ ...c, status: "error" });
        log({ connectionId: c.id }, "error", "run_failed",
          `Erro ao conectar: ${(err as Error).message}`);
      } finally {
        loginStopFlags.delete(c.id);
      }
    })();

    return reply.status(202).send({ ok: true });
  });

  // Marca a conexão como connected manualmente. Útil quando a detecção
  // automática de fim de login não disparou (sites com hash routing, etc.).
  // Também interrompe um ensureLogin em andamento.
  app.post<{ Params: { id: string } }>("/connections/:id/mark-connected", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });
    loginStopFlags.set(c.id, true);
    saveConnection({ ...c, status: "connected" });
    log({ connectionId: c.id }, "info", "login_detected",
      "Login marcado como concluído pelo usuário.");
    return { ok: true };
  });

  // Apenas reabre o browser, sem disparar fluxo de login (útil pra inspecionar)
  app.post<{ Params: { id: string } }>("/connections/:id/open", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });
    const agent = getOrCreateAgent({
      connectionId: c.id,
      startUrl: c.loginUrl ?? getConnector(c.type).startUrl,
      headless: false,
    });
    await agent.open();
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/connections/:id/close", async (req, reply) => {
    const c = getConnection(req.params.id);
    if (!c) return reply.status(404).send({ error: "not found" });
    await disposeAgent(c.id);
    return { ok: true };
  });
}
