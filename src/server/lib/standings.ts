import { getLeaderboardAttempts } from "../db/attempts.js";
import { getPlayerById, type PlayerRow } from "../db/players.js";
import { computeDisplaySafeName, computeDisplaySafeNameFromFields, displayIdentityKey } from "./displayName.js";
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
  const best = pickBestPerPlayer(
    rows.map((r) => ({
      playerId: r.playerId,
      // Leaderboard entries are grouped by displayed identity (name +
      // organization), not raw player id — two attempts that *look* like
      // the same entry on the board collapse to one row, best score wins.
      // Registration/login identity (email) is untouched by this.
      groupKey: displayIdentityKey(
        computeDisplaySafeNameFromFields({
          displayMode: r.displayMode,
          displayValue: r.displayValue,
          firstName: r.firstName,
          lastName: r.lastName,
          organization: r.organization,
        })
      ),
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

/** The group key a given player's own attempts would be filed under on the leaderboard (see buildRanked). */
export function groupKeyForPlayer(playerId: string): string | null {
  const player = getPlayerById(playerId);
  if (!player) return null;
  return displayIdentityKey(computeDisplaySafeName(player));
}

export function getPlayerStanding(ranked: RankedEntry[], playerId: string): Standing | null {
  const key = groupKeyForPlayer(playerId);
  if (!key) return null;
  return getStanding(ranked, key);
}

export function toPublicLeaderboard(
  board: "overall" | "daily",
  ranked: RankedEntry[],
  version: number,
  topN: number
): PublicLeaderboard {
  const top = ranked.slice(0, topN);
  const entries: LeaderboardEntry[] = top.map((entry) => {
    const player = getPlayerById(entry.playerId) as PlayerRow;
    const { displayName, organization } = computeDisplaySafeName(player);
    return { rank: entry.rank, displayName, organization, score: entry.score };
  });
  return {
    board,
    generatedAt: new Date().toISOString(),
    version,
    playerCount: ranked.length,
    entries,
  };
}
