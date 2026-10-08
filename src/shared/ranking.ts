export interface LeaderboardCandidate {
  playerId: string;
  score: number;
  /** Total elapsed time across the attempt's questions; timeouts count as the full limit. */
  elapsedMs: number;
  /** Attempt completion time, as an ISO string or any string that sorts chronologically. */
  finishedAt: string;
}

export interface RankedEntry extends LeaderboardCandidate {
  rank: number;
}

/**
 * Sorts candidates by: score desc, elapsedMs asc, finishedAt asc (earliest
 * wins), playerId asc as a final deterministic tiebreak. Ranks are assigned
 * 1..N by sorted position — no shared ranks, per "ranks are deterministic".
 */
export function rankEntries(candidates: LeaderboardCandidate[]): RankedEntry[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    if (a.finishedAt !== b.finishedAt) return a.finishedAt < b.finishedAt ? -1 : 1;
    return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
  });
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** ceil((rank/total)*100), i.e. "you scored as well as or better than players outside the top X%". */
export function computeTopPercent(rank: number, total: number): number {
  if (total <= 0) return 100;
  return Math.ceil((rank / total) * 100);
}

export interface Standing {
  rank: number;
  totalPlayers: number;
  topPercent: number;
  pointGapToFifth: number | null;
}

export function getStanding(ranked: RankedEntry[], playerId: string): Standing | null {
  const me = ranked.find((e) => e.playerId === playerId);
  if (!me) return null;
  const totalPlayers = ranked.length;
  const topPercent = computeTopPercent(me.rank, totalPlayers);

  let pointGapToFifth: number | null = null;
  if (me.rank > 5 && totalPlayers >= 5) {
    const fifth = ranked[4];
    if (fifth) {
      pointGapToFifth = Math.max(0, fifth.score - me.score);
    }
  }

  return { rank: me.rank, totalPlayers, topPercent, pointGapToFifth };
}
