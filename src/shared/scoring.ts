export interface ScoringParams {
  basePoints: number;
  speedBonusPoints: number;
  limitMs: number;
}

const DEFAULT_PARAMS: ScoringParams = {
  basePoints: 500,
  speedBonusPoints: 500,
  limitMs: 20000,
};

/**
 * Per-question points: 0 if incorrect or timed out, otherwise
 * base + round(bonus * max(0, 1 - t/limit)), t clamped to [0, limit].
 */
export function computePoints(
  correct: boolean,
  elapsedMs: number,
  params: ScoringParams = DEFAULT_PARAMS
): number {
  if (!correct) return 0;
  const { basePoints, speedBonusPoints, limitMs } = params;
  const t = Math.max(0, Math.min(elapsedMs, limitMs));
  const speedFraction = Math.max(0, 1 - t / limitMs);
  return basePoints + Math.round(speedBonusPoints * speedFraction);
}

export function sumAttemptScore(points: number[]): number {
  return points.reduce((a, b) => a + b, 0);
}
