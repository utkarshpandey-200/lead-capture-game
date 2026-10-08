import type { FastifyInstance } from "fastify";
import { config } from "../../shared/config.js";
import { registerSchema } from "../lib/validation.js";
import { registerOrResume, getAttemptsRemaining } from "../lib/registerService.js";
import { setPlayerSession, getPlayerIdFromRequest } from "../lib/session.js";
import { getPlayerById } from "../db/players.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/register",
    {
      config: {
        rateLimit: { max: 8, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const body = registerSchema.parse(req.body);

      const outcome = registerOrResume({
        firstName: body.firstName,
        lastName: body.lastName,
        organization: body.organization,
        email: body.email,
        displayMode: body.displayMode,
        nickname: body.nickname,
      });

      setPlayerSession(reply, outcome.player.id);
      const attemptsRemaining = getAttemptsRemaining(outcome.player.id);

      if (outcome.isReturning) {
        reply.send({
          isReturning: true,
          message: config.copy.welcomeBackText,
          attemptsRemaining,
          maxAttempts: config.quiz.maxAttempts,
          displayMode: outcome.player.display_mode,
          displayValue: outcome.player.display_value,
        });
        return;
      }

      reply.send({
        isReturning: false,
        firstName: outcome.player.first_name,
        attemptsRemaining,
        maxAttempts: config.quiz.maxAttempts,
        displayMode: outcome.player.display_mode,
        displayValue: outcome.player.display_value,
      });
    }
  );

  app.get("/api/me", async (req, reply) => {
    const playerId = getPlayerIdFromRequest(req);
    if (!playerId) {
      reply.send({ authenticated: false });
      return;
    }
    const player = getPlayerById(playerId);
    if (!player) {
      reply.send({ authenticated: false });
      return;
    }
    reply.send({
      authenticated: true,
      firstName: player.first_name,
      displayMode: player.display_mode,
      displayValue: player.display_value,
      attemptsRemaining: getAttemptsRemaining(player.id),
      maxAttempts: config.quiz.maxAttempts,
    });
  });
}
