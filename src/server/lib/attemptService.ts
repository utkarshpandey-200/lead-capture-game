import { config } from "../../shared/config.js";
import { computePoints } from "../../shared/scoring.js";
import { resolveElapsedMs } from "../../shared/timing.js";
import type { AttemptResult, AnswerOutcome, QuestionForClient } from "../../shared/types.js";
import {
  createAttempt,
  finalizeAttempt,
  getActiveAttemptForPlayer,
  getAttemptById,
  countRankedAttempts,
  getPlayerSeenQuestionIds,
  type AttemptRow,
} from "../db/attempts.js";
import {
  createAttemptQuestions,
  getAttemptQuestions,
  getAttemptQuestionByPosition,
  getCurrentAttemptQuestion,
  markServedIfNeeded,
  recordAnswer,
  type AttemptQuestionRow,
} from "../db/attemptQuestions.js";
import { getQuestionById, getQuestionPool } from "../db/questions.js";
import { newId } from "./ids.js";
import { eventDayFor } from "./eventDay.js";
import { selectQuestionsForAttempt } from "./questionSelection.js";
import { shuffleOptionIndices } from "./shuffle.js";
import {
  AttemptFinishedError,
  AttemptsExhaustedError,
  AlreadyAnsweredError,
  ForbiddenError,
  NotFoundError,
  WrongQuestionError,
} from "./errors.js";
import { bumpLeaderboardVersion } from "./leaderboardVersion.js";
import { getDailyRanked, getOverallRanked, getPlayerStanding } from "./standings.js";

function assertOwnedByPlayer(attempt: AttemptRow, playerId: string): void {
  if (attempt.player_id !== playerId) {
    throw new ForbiddenError("This attempt does not belong to the current session.");
  }
}

function buildAttemptResult(
  attempt: AttemptRow,
  answeredQuestions: AttemptQuestionRow[],
  playerId: string
): AttemptResult {
  const totalScore = answeredQuestions.reduce((sum, q) => sum + (q.points ?? 0), 0);
  const numCorrect = answeredQuestions.filter((q) => q.correct).length;
  const avgAnswerMs = Math.round(
    answeredQuestions.reduce((sum, q) => sum + (q.elapsed_ms ?? 0), 0) /
      Math.max(1, answeredQuestions.length)
  );
  const attemptsUsed = countRankedAttempts(playerId);
  const emptyStanding = { rank: 0, totalPlayers: 0, topPercent: 0, pointGapToFifth: null };

  if (attempt.is_practice) {
    return {
      totalScore,
      numCorrect,
      avgAnswerMs,
      overall: emptyStanding,
      daily: emptyStanding,
      attemptsUsed,
      maxAttempts: config.quiz.maxAttempts,
      isPractice: true,
    };
  }

  const overallStanding = getPlayerStanding(getOverallRanked(), playerId);
  const dailyStanding = getPlayerStanding(getDailyRanked(attempt.event_day), playerId);

  return {
    totalScore,
    numCorrect,
    avgAnswerMs,
    overall: overallStanding ?? emptyStanding,
    daily: dailyStanding ?? emptyStanding,
    attemptsUsed,
    maxAttempts: config.quiz.maxAttempts,
    isPractice: false,
  };
}

export function getActiveAttempt(playerId: string): AttemptRow | undefined {
  return getActiveAttemptForPlayer(playerId);
}

export function startAttempt(playerId: string, practice: boolean): AttemptRow {
  const existing = getActiveAttemptForPlayer(playerId);
  if (existing) return existing;

  if (!practice) {
    const used = countRankedAttempts(playerId);
    if (used >= config.quiz.maxAttempts) {
      throw new AttemptsExhaustedError();
    }
  }

  const pool = getQuestionPool(config.flags.allowDraftQuestions);
  const seenIds = getPlayerSeenQuestionIds(playerId);
  const selected = selectQuestionsForAttempt(
    pool,
    seenIds,
    config.quiz.knowledgeCount,
    config.quiz.scenarioCount,
    config.quiz.bonusCount
  );

  const attemptId = newId();
  const eventDay = eventDayFor(new Date(), config.eventTimeZone);
  const attempt = createAttempt(attemptId, playerId, eventDay, practice);

  createAttemptQuestions(
    attemptId,
    selected.map((q, position) => ({
      id: newId(),
      questionId: q.id,
      position,
      shuffledOptions: shuffleOptionIndices(),
    }))
  );

  return attempt;
}

function buildQuestionForClient(attempt: AttemptRow, aq: AttemptQuestionRow): QuestionForClient {
  const question = getQuestionById(aq.question_id);
  if (!question) throw new NotFoundError("Question");

  const servedAt = markServedIfNeeded(aq.id);
  const shuffledOptions: number[] = JSON.parse(aq.shuffled_options);
  const displayOptions = shuffledOptions.map((originalIdx) => question.options[originalIdx]!);

  const elapsedSinceServed = Date.now() - new Date(servedAt).getTime();
  const remainingMs = Math.max(0, config.quiz.questionTimeLimitMs - elapsedSinceServed);

  const allQuestions = getAttemptQuestions(attempt.id);
  const scoreSoFar = allQuestions.reduce((sum, q) => sum + (q.points ?? 0), 0);

  return {
    attemptId: attempt.id,
    position: aq.position,
    totalQuestions: allQuestions.length,
    questionId: question.id,
    category: question.category,
    type: question.type,
    prompt: question.prompt,
    options: displayOptions,
    remainingMs,
    servedAt,
    scoreSoFar,
  };
}

export function getCurrentQuestionForAttempt(attemptId: string, playerId: string): QuestionForClient {
  const attempt = getAttemptById(attemptId);
  if (!attempt) throw new NotFoundError("Attempt");
  assertOwnedByPlayer(attempt, playerId);
  if (attempt.status === "finished") throw new AttemptFinishedError();

  const current = getCurrentAttemptQuestion(attemptId);
  if (!current) throw new AttemptFinishedError();

  return buildQuestionForClient(attempt, current);
}

export interface AnswerInput {
  position: number;
  questionId: string;
  chosenOption: number | null;
  clientElapsedMs: number | null | undefined;
}

export function submitAnswer(attemptId: string, playerId: string, input: AnswerInput): AnswerOutcome {
  const attempt = getAttemptById(attemptId);
  if (!attempt) throw new NotFoundError("Attempt");
  assertOwnedByPlayer(attempt, playerId);
  if (attempt.status === "finished") throw new AttemptFinishedError();

  const targeted = getAttemptQuestionByPosition(attemptId, input.position);
  if (!targeted || targeted.question_id !== input.questionId) {
    throw new WrongQuestionError();
  }
  if (targeted.answered_at) throw new AlreadyAnsweredError();

  const current = getCurrentAttemptQuestion(attemptId);
  if (!current || current.id !== targeted.id) {
    // The targeted question exists and is unanswered, but isn't the
    // earliest unanswered one — the client is out of sync.
    throw new WrongQuestionError();
  }
  if (!current.served_at) {
    // Defensive: a question must be fetched (served) before it can be answered.
    markServedIfNeeded(current.id);
  }

  const question = getQuestionById(current.question_id);
  if (!question) throw new NotFoundError("Question");

  const servedAt = current.served_at ?? new Date().toISOString();
  const answeredAt = new Date();
  const serverElapsedMs = answeredAt.getTime() - new Date(servedAt).getTime();
  const limitMs = config.quiz.questionTimeLimitMs;

  const elapsedMs = resolveElapsedMs({
    clientElapsedMs: input.clientElapsedMs,
    serverElapsedMs,
    limitMs,
    toleranceMs: config.quiz.clientTimingToleranceMs,
  });

  const shuffledOptions: number[] = JSON.parse(current.shuffled_options);
  let correct = false;
  if (input.chosenOption != null) {
    const originalIdx = shuffledOptions[input.chosenOption];
    correct = originalIdx === question.correctIndex;
  }

  const points = computePoints(correct, elapsedMs, {
    basePoints: config.quiz.basePoints,
    speedBonusPoints: config.quiz.speedBonusPoints,
    limitMs,
  });

  recordAnswer(current.id, {
    answeredAt: answeredAt.toISOString(),
    chosenOption: input.chosenOption,
    correct,
    elapsedMs,
    points,
  });

  const correctOptionDisplayIndex = shuffledOptions.indexOf(question.correctIndex);

  const allQuestions = getAttemptQuestions(attemptId);
  const answeredSoFar = allQuestions.filter((q) => q.answered_at != null);
  const scoreSoFar = answeredSoFar.reduce((sum, q) => sum + (q.points ?? 0), 0);
  const isLastQuestion = answeredSoFar.length === allQuestions.length;

  let nextIsBonus = false;
  if (!isLastQuestion) {
    const nextAq = allQuestions.find((q) => q.position === current.position + 1);
    const nextQuestion = nextAq ? getQuestionById(nextAq.question_id) : undefined;
    nextIsBonus = nextQuestion?.type === "bonus";
  }

  let result: AttemptResult | null = null;

  if (isLastQuestion) {
    const finished = finalizeAttempt(attemptId);
    if (!attempt.is_practice) {
      bumpLeaderboardVersion();
    }
    result = buildAttemptResult(finished, answeredSoFar, playerId);
  }

  return {
    correct,
    correctOptionDisplayIndex,
    explanation: question.explanation,
    reference: question.reference,
    pointsEarned: points,
    scoreSoFar,
    isLastQuestion,
    nextPosition: isLastQuestion ? null : current.position + 1,
    nextIsBonus,
    result,
  };
}

export function getAttemptResult(attemptId: string, playerId: string): AttemptResult {
  const attempt = getAttemptById(attemptId);
  if (!attempt) throw new NotFoundError("Attempt");
  assertOwnedByPlayer(attempt, playerId);
  if (attempt.status !== "finished") throw new NotFoundError("Result");

  const allQuestions = getAttemptQuestions(attemptId);
  return buildAttemptResult(attempt, allQuestions, playerId);
}
