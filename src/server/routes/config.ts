import type { FastifyInstance } from "fastify";
import { getPublicConfig } from "../../shared/config.js";

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/config", async () => getPublicConfig());
}
