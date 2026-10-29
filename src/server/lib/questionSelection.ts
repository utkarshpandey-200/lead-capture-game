import type { QuestionRow } from "../db/questions.js";
import { shuffle } from "./shuffle.js";

export class InsufficientQuestionsError extends Error {
  constructor(type: string, needed: number, available: number) {
    super(
      `Not enough ${type} questions to build an attempt: need ${needed}, have ${available} approved.`
    );
    this.name = "InsufficientQuestionsError";
  }
}

function pickForType(pool: QuestionRow[], seenIds: Set<string>, count: number): QuestionRow[] {
  const unseen = shuffle(pool.filter((q) => !seenIds.has(q.id)));
  const seen = shuffle(pool.filter((q) => seenIds.has(q.id)));
  const combined = [...unseen, ...seen];
  if (combined.length < count) {
    throw new InsufficientQuestionsError(pool[0]?.type ?? "unknown", count, combined.length);
  }
  return combined.slice(0, count);
}

/**
 * Selects `knowledgeCount` + `scenarioCount` + `bonusCount` questions for one
 * attempt, preferring questions the player hasn't been served before (across
 * any attempt), falling back to repeats only if the pool is too small.
 * Knowledge/scenario questions are shuffled together; bonus questions are
 * always appended after, in their own stable order, never mixed into the
 * shuffle — with exactly one `type: "bonus"` question in the pool (the usual
 * case), this always surfaces as the same fixed last question of the attempt.
 */
export function selectQuestionsForAttempt(
  pool: QuestionRow[],
  seenIds: Set<string>,
  knowledgeCount: number,
  scenarioCount: number,
  bonusCount: number
): QuestionRow[] {
  const knowledgePool = pool.filter((q) => q.type === "knowledge");
  const scenarioPool = pool.filter((q) => q.type === "scenario");
  const bonusPool = pool.filter((q) => q.type === "bonus");
  const knowledge = pickForType(knowledgePool, seenIds, knowledgeCount);
  const scenario = pickForType(scenarioPool, seenIds, scenarioCount);
  const randomized = shuffle([...knowledge, ...scenario]);
  const bonus = bonusCount > 0 ? pickForType(bonusPool, seenIds, bonusCount) : [];
  return [...randomized, ...bonus];
}
