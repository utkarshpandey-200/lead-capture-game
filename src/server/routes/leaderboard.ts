import type { FastifyInstance } from "fastify";
import { config } from "../../shared/config.js";
import { eventDayFor } from "../lib/eventDay.js";
import { getLeaderboardVersion } from "../lib/leaderboardVersion.js";
import { getDailyRanked, getOverallRanked, toPublicLeaderboard } from "../lib/standings.js";
import { getRankedEventDays } from "../db/attempts.js";

const EVENT_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/leaderboard/top", async (req, reply) => {
    const query = req.query as { board?: string; date?: string };
    const board = query.board === "daily" ? "daily" : "overall";
    const eventDay =
      board === "daily"
        ? query.date && EVENT_DAY_RE.test(query.date)
          ? query.date
          : eventDayFor(new Date(), config.eventTimeZone)
        : undefined;
    const version = getLeaderboardVersion();
    const etag = board === "daily" ? `"lb-daily-${eventDay}-${version}"` : `"lb-overall-${version}"`;

    if (req.headers["if-none-match"] === etag) {
      reply.code(304).send();
      return;
    }

    const ranked = board === "daily" ? getDailyRanked(eventDay!) : getOverallRanked();
    const payload = toPublicLeaderboard(board, ranked, version, config.display.topN, eventDay);

    reply.header("ETag", etag);
    reply.header("Cache-Control", "no-cache");
    reply.send(payload);
  });

  // The list of event days that have at least one ranked play, so the display
  // screen's date filter only ever offers days that actually have data.
  app.get("/api/leaderboard/days", async (_req, reply) => {
    reply.header("Cache-Control", "no-cache");
    reply.send({ days: getRankedEventDays() });
  });
}
