import type { FastifyInstance } from "fastify";
import { agentBus } from "@targeting/agent";

// SSE de logs do agente. Cliente pode filtrar por connectionId/runId via query.
export async function eventsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { connectionId?: string; runId?: string } }>(
    "/events",
    (req, reply) => {
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("Access-Control-Allow-Origin", "*");
      reply.raw.flushHeaders?.();

      const send = (data: unknown) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // heartbeat
      const hb = setInterval(() => {
        reply.raw.write(`: ping\n\n`);
      }, 15_000);

      const off = agentBus.onEvent((evt) => {
        if (req.query.connectionId && evt.connectionId !== req.query.connectionId) return;
        if (req.query.runId && evt.runId !== req.query.runId) return;
        send(evt);
      });

      req.raw.on("close", () => {
        clearInterval(hb);
        off();
      });
    },
  );
}
