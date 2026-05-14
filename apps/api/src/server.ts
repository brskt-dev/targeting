import Fastify from "fastify";
import cors from "@fastify/cors";
import { searchRoutes } from "./routes/search";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "*",
  });

  await app.register(searchRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
