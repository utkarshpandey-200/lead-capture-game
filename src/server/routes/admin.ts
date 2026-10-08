import type { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { config } from "../../shared/config.js";
import { adminLoginSchema } from "../lib/validation.js";
import { setAdminSession, getAdminTokenFromRequest, clearAdminSession } from "../lib/session.js";
import { ForbiddenError } from "../lib/errors.js";

// In-memory admin session tokens. The booth runs one admin process; tokens
// don't need to survive a restart, and restarting simply logs the admin out.
const activeAdminTokens = new Map<string, number>(); // token -> expiresAtMs

function requireAdmin(req: FastifyRequest): void {
  const token = getAdminTokenFromRequest(req);
  const expiresAt = token ? activeAdminTokens.get(token) : undefined;
  if (!token || !expiresAt || expiresAt < Date.now()) {
    throw new ForbiddenError("Admin login required.");
  }
}

export { requireAdmin };

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/admin/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = adminLoginSchema.parse(req.body);
      if (!config.server.adminPassword || body.password !== config.server.adminPassword) {
        reply.code(401).send({ error: "invalid_password", message: "Incorrect password." });
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      activeAdminTokens.set(token, Date.now() + config.server.adminSessionTtlMs);
      setAdminSession(reply, token);
      reply.send({ ok: true });
    }
  );

  app.post("/api/admin/logout", async (req, reply) => {
    const token = getAdminTokenFromRequest(req);
    if (token) activeAdminTokens.delete(token);
    clearAdminSession(reply);
    reply.send({ ok: true });
  });

  app.get("/api/admin/whoami", async (req, reply) => {
    try {
      requireAdmin(req);
      reply.send({ authenticated: true });
    } catch {
      reply.send({ authenticated: false });
    }
  });
}
