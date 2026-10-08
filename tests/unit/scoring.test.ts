import { describe, it, expect } from "vitest";
import { computePoints, sumAttemptScore } from "../../src/shared/scoring";

const limit = 20000;

describe("computePoints", () => {
  const cases: [string, boolean, number, number][] = [
    ["correct at 2s", true, 2000, 950],
    ["correct at 10s", true, 10000, 750],
    ["correct at 19s", true, 19000, 525],
    ["correct instantly", true, 0, 1000],
    ["correct at exactly the limit", true, 20000, 500],
    ["correct past the limit (clamped)", true, 25000, 500],
    ["wrong answer", false, 2000, 0],
    ["timeout", false, 20000, 0],
    ["negative elapsed (clamped)", true, -500, 1000],
  ];

  it.each(cases)("%s -> %i points", (_label, correct, elapsedMs, expected) => {
    expect(computePoints(correct, elapsedMs, { basePoints: 500, speedBonusPoints: 500, limitMs: limit })).toBe(
      expected
    );
  });

  it("supports custom scoring params", () => {
    expect(computePoints(true, 0, { basePoints: 100, speedBonusPoints: 100, limitMs: 10000 })).toBe(200);
    expect(computePoints(true, 10000, { basePoints: 100, speedBonusPoints: 100, limitMs: 10000 })).toBe(100);
  });
});

describe("sumAttemptScore", () => {
  it("sums points across questions, max 5000 for 5 perfect instant answers", () => {
    expect(sumAttemptScore([1000, 1000, 1000, 1000, 1000])).toBe(5000);
  });

  it("handles a mixed attempt", () => {
    expect(sumAttemptScore([950, 750, 0, 525, 0])).toBe(2225);
  });

  it("handles an all-zero attempt", () => {
    expect(sumAttemptScore([0, 0, 0, 0, 0])).toBe(0);
  });
});
