import { getLeaderboardAttempts } from "../db/attempts.js";
import { getPlayerById, type PlayerRow } from "../db/players.js";
import { computeDisplaySafeName } from "./displayName.js";
import {
  rankEntries,
  pickBestPerPlayer,
  getStanding,
  type RankedEntry,
  type Standing,
} from "../../shared/ranking.js";
import type { LeaderboardEntry, PublicLeaderboard } from "../../shared/types.js";

function buildRanked(eventDay?: string): RankedEntry[] {
  const rows = getLeaderboardAttempts(eventDay);
  // One row per player id — every registration is its own entry, so there's
  // no grouping beyond "this player's own best finished attempt".
  const best = pickBestPerPlayer(
    rows.map((r) => ({
      playerId: r.playerId,
      score: r.score,
      elapsedMs: r.elapsedMs,
      finishedAt: r.finishedAt,
    }))
  );
  return rankEntries(best);
}

export function getOverallRanked(): RankedEntry[] {
  return buildRanked(undefined);
}

export function getDailyRanked(eventDay: string): RankedEntry[] {
  return buildRanked(eventDay);
}

export function getPlayerStanding(ranked: RankedEntry[], playerId: string): Standing | null {
  return getStanding(ranked, playerId);
}

export function toPublicLeaderboard(
  board: "overall" | "daily",
  ranked: RankedEntry[],
  version: number,
  topN: number,
  eventDay?: string
): PublicLeaderboard {
  const top = ranked.slice(0, topN);
  const entries: LeaderboardEntry[] = top.map((entry) => {
    const player = getPlayerById(entry.playerId) as PlayerRow;
    const { displayName, organization } = computeDisplaySafeName(player);
    return { rank: entry.rank, displayName, organization, score: entry.score };
  });
  return {
    board,
    eventDay,
    generatedAt: new Date().toISOString(),
    version,
    playerCount: ranked.length,
    entries,
  };
}
