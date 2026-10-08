import type { FastifyInstance } from "fastify";
import { config } from "../../shared/config.js";
import { eventDayFor } from "../lib/eventDay.js";
import { getLeaderboardVersion } from "../lib/leaderboardVersion.js";
import { getDailyRanked, getOverallRanked, toPublicLeaderboard } from "../lib/standings.js";

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/leaderboard/top", async (req, reply) => {
    const query = req.query as { board?: string };
    const board = query.board === "daily" ? "daily" : "overall";
    const version = getLeaderboardVersion();
    const etag = `"lb-${board}-${version}"`;

    if (req.headers["if-none-match"] === etag) {
      reply.code(304).send();
      return;
    }

    const ranked =
      board === "daily" ? getDailyRanked(eventDayFor(new Date(), config.eventTimeZone)) : getOverallRanked();
    const payload = toPublicLeaderboard(board, ranked, version, config.display.topN);

    reply.header("ETag", etag);
    reply.header("Cache-Control", "no-cache");
    reply.send(payload);
  });
}
