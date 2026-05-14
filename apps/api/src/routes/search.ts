import type { FastifyInstance } from "fastify";
import type { SearchInput, Platform } from "@targeting/shared";
import { runSearch } from "@targeting/scrapers";

const VALID_PLATFORMS: Platform[] = ["google_search", "google_maps", "instagram", "linkedin"];
const VALID_TARGET_TYPES = ["person", "company"] as const;

export async function searchRoutes(app: FastifyInstance) {
  app.post<{ Body: SearchInput }>("/search", async (request, reply) => {
    const { query, targetType, platforms, location } = request.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.status(400).send({ error: "query is required" });
    }

    if (!VALID_TARGET_TYPES.includes(targetType as (typeof VALID_TARGET_TYPES)[number])) {
      return reply.status(400).send({ error: "targetType must be 'person' or 'company'" });
    }

    if (!Array.isArray(platforms) || platforms.length === 0) {
      return reply.status(400).send({ error: "platforms must be a non-empty array" });
    }

    const invalidPlatforms = platforms.filter((p) => !VALID_PLATFORMS.includes(p));
    if (invalidPlatforms.length > 0) {
      return reply.status(400).send({
        error: `invalid platforms: ${invalidPlatforms.join(", ")}. Valid: ${VALID_PLATFORMS.join(", ")}`,
      });
    }

    const response = await runSearch({
      query: query.trim(),
      targetType,
      platforms,
      location,
    });

    return reply.send(response);
  });
}
