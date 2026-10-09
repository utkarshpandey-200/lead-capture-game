import type { FastifyInstance } from "fastify";
import { config } from "../../shared/config.js";
import { startAttemptSchema, submitAnswerSchema } from "../lib/validation.js";
import { requirePlayerId } from "../lib/requirePlayer.js";
import {
  getActiveAttempt,
  startAttempt,
  getCurrentQuestionForAttempt,
  submitAnswer,
  getAttemptResult,
} from "../lib/attemptService.js";
import { NotFoundError } from "../lib/errors.js";

export async function attemptRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/attempts/start", async (req, reply) => {
    const playerId = requirePlayerId(req);
    const body = startAttemptSchema.parse(req.body ?? {});
    const attempt = startAttempt(playerId, body.practice);
    reply.send({ attemptId: attempt.id, isPractice: !!attempt.is_practice });
  });

  app.get("/api/attempts/current", async (req, reply) => {
    const playerId = requirePlayerId(req);
    const attempt = getActiveAttempt(playerId);
    if (!attempt) {
      reply.send({ active: false });
      return;
    }
    const question = getCurrentQuestionForAttempt(attempt.id, playerId);
    reply.send({ active: true, attemptId: attempt.id, isPractice: !!attempt.is_practice, question });
  });

  app.get("/api/attempts/:attemptId/question", async (req, reply) => {
    const playerId = requirePlayerId(req);
    const { attemptId } = req.params as { attemptId: string };
    const question = getCurrentQuestionForAttempt(attemptId, playerId);
    reply.send(question);
  });

  app.post(
    "/api/attempts/:attemptId/answer",
    {
      config: {
        rateLimit: { max: config.rateLimits.answerMax, timeWindow: "1 minute" },
      },
    },
    async (req, reply) => {
      const playerId = requirePlayerId(req);
      const { attemptId } = req.params as { attemptId: string };
      const body = submitAnswerSchema.parse(req.body);
      const outcome = submitAnswer(attemptId, playerId, {
        position: body.position,
        questionId: body.questionId,
        chosenOption: body.chosenOption,
        clientElapsedMs: body.clientElapsedMs ?? null,
      });
      reply.send(outcome);
    }
  );

  app.get("/api/attempts/:attemptId/result", async (req, reply) => {
    const playerId = requirePlayerId(req);
    const { attemptId } = req.params as { attemptId: string };
    const result = getAttemptResult(attemptId, playerId);
    if (!result) throw new NotFoundError("Result");
    reply.send(result);
  });
}
