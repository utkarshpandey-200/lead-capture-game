import type { FastifyInstance, FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { config } from "../../shared/config.js";
import {
  adminLoginSchema,
  questionImportSchema,
  questionStatusSchema,
} from "../lib/validation.js";
import { setAdminSession, getAdminTokenFromRequest, clearAdminSession } from "../lib/session.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";
import {
  listPlayersForAdmin,
  setPlayerHidden,
  setPlayerTestFlag,
  deletePlayerCascade,
  wipeTestData,
  getPlayerById,
  type AdminPlayerListParams,
} from "../db/players.js";
import {
  getAllQuestionsForAdmin,
  setQuestionStatus,
  upsertQuestions,
} from "../db/questions.js";
import { buildLeadListCsv } from "../lib/adminExport.js";
import { bumpLeaderboardVersion } from "../lib/leaderboardVersion.js";

const activeAdminTokens = new Map<string, number>(); // token -> expiresAtMs

function requireAdmin(req: FastifyRequest): void {
  const token = getAdminTokenFromRequest(req);
  const expiresAt = token ? activeAdminTokens.get(token) : undefined;
  if (!token || !expiresAt || expiresAt < Date.now()) {
    throw new ForbiddenError("Admin login required.");
  }
}

export { requireAdmin };

const adminOnly = { preHandler: async (req: FastifyRequest) => requireAdmin(req) };

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

  // --- Players ---

  app.get("/api/admin/players", adminOnly, async (req, reply) => {
    const query = req.query as { search?: string; sortBy?: string; sortDir?: string };
    const params: AdminPlayerListParams = {
      search: query.search,
      sortBy: query.sortBy as AdminPlayerListParams["sortBy"],
      sortDir: query.sortDir === "asc" ? "asc" : "desc",
    };
    reply.send(listPlayersForAdmin(params));
  });

  app.post("/api/admin/players/:id/hide", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { hidden: boolean };
    if (!getPlayerById(id)) throw new NotFoundError("Player");
    setPlayerHidden(id, !!body.hidden);
    bumpLeaderboardVersion();
    reply.send({ ok: true });
  });

  app.post("/api/admin/players/:id/test-flag", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { isTest: boolean };
    if (!getPlayerById(id)) throw new NotFoundError("Player");
    setPlayerTestFlag(id, !!body.isTest);
    bumpLeaderboardVersion();
    reply.send({ ok: true });
  });

  app.delete("/api/admin/players/:id", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!getPlayerById(id)) throw new NotFoundError("Player");
    deletePlayerCascade(id);
    bumpLeaderboardVersion();
    reply.send({ ok: true });
  });

  app.post("/api/admin/wipe-test-data", adminOnly, async (req, reply) => {
    const body = req.body as { confirm?: boolean };
    if (body.confirm !== true) {
      reply.code(400).send({ error: "confirmation_required", message: "Pass { confirm: true } to wipe test data." });
      return;
    }
    const result = wipeTestData();
    bumpLeaderboardVersion();
    reply.send({ ok: true, playersDeleted: result.playersDeleted });
  });

  app.get("/api/admin/export.csv", adminOnly, async (req, reply) => {
    const csv = buildLeadListCsv();
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="quiz-leads-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  // --- Questions ---

  app.get("/api/admin/questions", adminOnly, async (req, reply) => {
    reply.send(getAllQuestionsForAdmin());
  });

  app.post("/api/admin/questions/:id/status", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = questionStatusSchema.parse(req.body);
    setQuestionStatus(id, body.status);
    reply.send({ ok: true });
  });

  app.post("/api/admin/questions/import", adminOnly, async (req, reply) => {
    const body = questionImportSchema.parse(req.body);
    const result = upsertQuestions(body);
    reply.send({ ok: true, count: result.count });
  });
}
