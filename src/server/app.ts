import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { config } from "../shared/config.js";
import { db } from "./db/index.js";
import { loadQuestionsFromSeedFile } from "./db/questions.js";
import { AppError } from "./lib/errors.js";
import { configRoutes } from "./routes/config.js";
import { authRoutes } from "./routes/auth.js";
import { attemptRoutes } from "./routes/attempts.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { adminRoutes } from "./routes/admin.js";

// Both `tsx src/server/index.ts` (dev) and `node dist/server/server/index.js`
// (prod, via npm start) are launched with the project root as the cwd.
const projectRoot = process.cwd();
const clientDistDir = path.join(projectRoot, "dist/client");
const seedFilePath = path.join(projectRoot, "data/questions.seed.json");

function seedQuestionsIfEmpty(app: FastifyInstance): void {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM questions`).get() as { n: number };
  if (row.n === 0) {
    const result = loadQuestionsFromSeedFile(seedFilePath);
    app.log.info(`Seeded ${result.count} questions from ${seedFilePath}`);
  }
}

export interface BuildAppOptions {
  logger?: boolean;
  serveClient?: boolean;
}

/** Builds a fully configured Fastify app without binding a port, so tests can use `.inject()`. */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: config.server.trustProxy,
  });

  seedQuestionsIfEmpty(app);

  await app.register(fastifyCookie, { secret: config.server.sessionSecret });
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // the SPA's own build controls script/style sources; CSP tuning is a deploy-time decision
  });

  if (config.server.corsOrigin) {
    await app.register(fastifyCors, {
      origin: config.server.corsOrigin,
      credentials: true,
    });
  }

  await app.register(fastifyRateLimit, {
    max: config.rateLimits.globalMax,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({ error: err.code, message: err.message });
      return;
    }
    if (err instanceof ZodError) {
      reply.code(400).send({ error: "invalid_request", message: "The request was invalid." });
      return;
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      reply.code(429).send({ error: "rate_limited", message: "Too many requests. Please slow down." });
      return;
    }
    req.log.error(err);
    reply.code(500).send({ error: "internal_error", message: "Something went wrong." });
  });

  await app.register(configRoutes);
  await app.register(authRoutes);
  await app.register(attemptRoutes);
  await app.register(leaderboardRoutes);
  await app.register(adminRoutes);

  if (options.serveClient ?? true) {
    await app.register(fastifyStatic, {
      root: clientDistDir,
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api/")) {
        reply.code(404).send({ error: "not_found", message: "Not found." });
        return;
      }
      reply.sendFile("index.html");
    });
  } else {
    app.setNotFoundHandler((req, reply) => {
      reply.code(404).send({ error: "not_found", message: "Not found." });
    });
  }

  return app;
}
