import type { FastifyInstance } from "fastify";
import type { SearchInput } from "@targeting/shared";
import { runSearch } from "@targeting/scrapers";

const VALID_PLATFORMS = ["google", "maps", "instagram", "linkedin"] as const;
const VALID_TARGET_TYPES = ["person", "company"] as const;

export async function searchRoutes(app: FastifyInstance) {
  app.post<{ Body: SearchInput }>("/search", async (request, reply) => {
    const { query, targetType, platform, location } = request.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.status(400).send({ error: "query is required" });
    }

    if (!VALID_TARGET_TYPES.includes(targetType as (typeof VALID_TARGET_TYPES)[number])) {
      return reply.status(400).send({ error: "targetType must be 'person' or 'company'" });
    }

    if (!VALID_PLATFORMS.includes(platform as (typeof VALID_PLATFORMS)[number])) {
      return reply.status(400).send({ error: `platform must be one of: ${VALID_PLATFORMS.join(", ")}` });
    }

    try {
      const results = await runSearch({ query: query.trim(), targetType, platform, location });
      return reply.send({ results });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      return reply.status(500).send({ error: message });
    }
  });
}
