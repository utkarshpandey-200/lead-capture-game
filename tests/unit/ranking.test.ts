import { describe, it, expect } from "vitest";
import {
  rankEntries,
  computeTopPercent,
  getStanding,
  pickBestPerPlayer,
  type LeaderboardCandidate,
} from "../../src/shared/ranking";

function c(
  playerId: string,
  score: number,
  elapsedMs: number,
  finishedAt: string
): LeaderboardCandidate {
  return { playerId, score, elapsedMs, finishedAt };
}

describe("rankEntries", () => {
  it("orders by score descending", () => {
    const ranked = rankEntries([
      c("a", 1000, 5000, "2026-11-03T10:00:00Z"),
      c("b", 3000, 5000, "2026-11-03T10:00:00Z"),
      c("d", 2000, 5000, "2026-11-03T10:00:00Z"),
    ]);
    expect(ranked.map((e) => e.playerId)).toEqual(["b", "d", "a"]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("breaks score ties by total elapsed time ascending", () => {
    const ranked = rankEntries([
      c("slow", 3000, 9000, "2026-11-03T10:00:00Z"),
      c("fast", 3000, 4000, "2026-11-03T10:00:00Z"),
    ]);
    expect(ranked.map((e) => e.playerId)).toEqual(["fast", "slow"]);
  });

  it("breaks score+time ties by earliest completion", () => {
    const ranked = rankEntries([
      c("later", 3000, 4000, "2026-11-03T10:05:00Z"),
      c("earlier", 3000, 4000, "2026-11-03T10:00:00Z"),
    ]);
    expect(ranked.map((e) => e.playerId)).toEqual(["earlier", "later"]);
  });

  it("breaks a fully tied score/time/completion by player id for determinism", () => {
    const ranked = rankEntries([
      c("zzz", 3000, 4000, "2026-11-03T10:00:00Z"),
      c("aaa", 3000, 4000, "2026-11-03T10:00:00Z"),
    ]);
    expect(ranked.map((e) => e.playerId)).toEqual(["aaa", "zzz"]);
  });

  it("treats a timeout's elapsed time as the full limit when the caller passes it that way", () => {
    // Caller is responsible for mapping timeouts to the full limit before calling rankEntries;
    // this test documents that a higher elapsedMs (e.g. a timeout) loses the tiebreak.
    const ranked = rankEntries([
      c("timeout-player", 2000, 20000, "2026-11-03T10:00:00Z"),
      c("answered-player", 2000, 12000, "2026-11-03T10:00:00Z"),
    ]);
    expect(ranked.map((e) => e.playerId)).toEqual(["answered-player", "timeout-player"]);
  });

  it("assigns strictly increasing ranks with no ties", () => {
    const ranked = rankEntries([
      c("a", 100, 100, "t1"),
      c("b", 100, 100, "t1"),
      c("c", 100, 100, "t1"),
    ]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
  });
});

describe("pickBestPerPlayer", () => {
  it("keeps only the best attempt per player using the standard tiebreak order", () => {
    const best = pickBestPerPlayer([
      c("p1", 3000, 5000, "t1"),
      c("p1", 4000, 5000, "t2"),
      c("p1", 4000, 3000, "t3"),
      c("p2", 2000, 5000, "t1"),
    ]);
    expect(best).toHaveLength(2);
    const p1 = best.find((e) => e.playerId === "p1");
    expect(p1).toEqual(c("p1", 4000, 3000, "t3"));
  });

  it("returns an empty array for no candidates", () => {
    expect(pickBestPerPlayer([])).toEqual([]);
  });

  it("groups by groupKey instead of playerId when groupKey is set", () => {
    // Two different raw players sharing a groupKey (e.g. same displayed name) collapse to one entry.
    const best = pickBestPerPlayer([
      { ...c("player-a", 3000, 5000, "t1"), groupKey: "jane|acme cu" },
      { ...c("player-b", 4000, 5000, "t2"), groupKey: "jane|acme cu" },
      { ...c("player-c", 2000, 5000, "t1"), groupKey: "other|other cu" },
    ]);
    expect(best).toHaveLength(2);
    const janeGroup = best.find((e) => e.groupKey === "jane|acme cu");
    expect(janeGroup?.playerId).toBe("player-b"); // the higher score within the group wins
    expect(janeGroup?.score).toBe(4000);
  });
});

describe("computeTopPercent", () => {
  const cases: [number, number, number][] = [
    [1, 100, 1],
    [12, 100, 12],
    [1, 1, 100],
    [5, 5, 100],
    [1, 8, 13],
    [50, 100, 50],
    [100, 100, 100],
  ];

  it.each(cases)("rank %i of %i -> top %i%%", (rank, total, expected) => {
    expect(computeTopPercent(rank, total)).toBe(expected);
  });
});

describe("getStanding", () => {
  const candidates = [
    c("p1", 5000, 1000, "2026-11-03T10:00:00Z"),
    c("p2", 4500, 2000, "2026-11-03T10:00:01Z"),
    c("p3", 4000, 3000, "2026-11-03T10:00:02Z"),
    c("p4", 3500, 4000, "2026-11-03T10:00:03Z"),
    c("p5", 3000, 5000, "2026-11-03T10:00:04Z"),
    c("p6", 2500, 6000, "2026-11-03T10:00:05Z"),
    c("p7", 2000, 7000, "2026-11-03T10:00:06Z"),
  ];
  const ranked = rankEntries(candidates);

  it("returns null for an unknown player", () => {
    expect(getStanding(ranked, "nope")).toBeNull();
  });

  it("gives top-5 players no point gap", () => {
    const standing = getStanding(ranked, "p5");
    expect(standing?.rank).toBe(5);
    expect(standing?.pointGapToFifth).toBeNull();
  });

  it("gives players outside the top 5 their point gap to 5th place", () => {
    const standing = getStanding(ranked, "p7");
    expect(standing?.rank).toBe(7);
    expect(standing?.pointGapToFifth).toBe(1000); // 3000 (5th place) - 2000 (p7)
  });

  it("computes totalPlayers and topPercent consistently with rankEntries", () => {
    const standing = getStanding(ranked, "p3");
    expect(standing?.totalPlayers).toBe(7);
    expect(standing?.topPercent).toBe(computeTopPercent(3, 7));
  });

  it("returns null point gap when there is no 5th place yet (fewer than 5 players)", () => {
    const small = rankEntries([c("a", 100, 100, "t1"), c("b", 90, 100, "t2")]);
    const standing = getStanding(small, "b");
    expect(standing?.pointGapToFifth).toBeNull();
  });

  it("finds a player by groupKey even when a different raw player won that group", () => {
    // Mirrors the real pipeline: dedupe by groupKey first, then rank — so
    // player-a's own playerId is entirely absent from the final ranked
    // array (only player-b, the group's winner, survives pickBestPerPlayer).
    const deduped = pickBestPerPlayer([
      { ...c("player-a", 3000, 5000, "t1"), groupKey: "jane|acme cu" },
      { ...c("player-b", 4000, 5000, "t2"), groupKey: "jane|acme cu" }, // wins the group
      { ...c("player-c", 2000, 5000, "t1"), groupKey: "other|other cu" },
    ]);
    const grouped = rankEntries(deduped);
    expect(grouped.map((e) => e.playerId)).not.toContain("player-a");

    // Looking up by player-a's own groupKey should still resolve to the
    // group's rank/score, not come back null just because player-a's own
    // attempt wasn't the one that won the group.
    const standing = getStanding(grouped, "jane|acme cu");
    expect(standing?.rank).toBe(1);
  });
});
