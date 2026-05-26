import type { FastifyInstance } from "fastify";

// Rota legada da busca pública. O código antigo ficou em packages/scrapers
// mas não está mais wirado por padrão. Retornamos 410 (Gone) deixando claro
// que o produto pivotou.
export async function legacySearchRoutes(app: FastifyInstance) {
  app.post("/search", async (_req, reply) => {
    return reply.status(410).send({
      error: "endpoint legado",
      message:
        "A busca pública por leads foi descontinuada. O novo Targeting trabalha com plataformas autenticadas. Use /connections, /scan e /lead-query.",
    });
  });
}
