import { db } from "./index.js";

export interface AttemptRow {
  id: string;
  player_id: string;
  started_at: string;
  finished_at: string | null;
  total_score: number;
  total_elapsed_ms: number;
  event_day: string;
  is_practice: number;
  status: "in_progress" | "finished";
}

export function createAttempt(
  id: string,
  playerId: string,
  eventDay: string,
  isPractice: boolean
): AttemptRow {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO attempts (id, player_id, started_at, event_day, is_practice, status)
     VALUES (?, ?, ?, ?, ?, 'in_progress')`
  ).run(id, playerId, now, eventDay, isPractice ? 1 : 0);
  return getAttemptById(id)!;
}

/** Every event day that has at least one ranked (non-practice, finished) attempt, most recent first. */
export function getRankedEventDays(): string[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT event_day FROM attempts WHERE status = 'finished' AND is_practice = 0 ORDER BY event_day DESC`
    )
    .all() as { event_day: string }[];
  return rows.map((r) => r.event_day);
}

export function getAttemptById(id: string): AttemptRow | undefined {
  return db.prepare(`SELECT * FROM attempts WHERE id = ?`).get(id) as AttemptRow | undefined;
}

export function getActiveAttemptForPlayer(playerId: string): AttemptRow | undefined {
  return db
    .prepare(
      `SELECT * FROM attempts WHERE player_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`
    )
    .get(playerId) as AttemptRow | undefined;
}

/** Non-practice attempts count toward the MAX_ATTEMPTS cap; practice attempts don't. */
export function countRankedAttempts(playerId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM attempts WHERE player_id = ? AND is_practice = 0`)
    .get(playerId) as { n: number };
  return row.n;
}

export function finalizeAttempt(attemptId: string): AttemptRow {
  const now = new Date().toISOString();
  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(points), 0) AS totalScore, COALESCE(SUM(elapsed_ms), 0) AS totalElapsed
       FROM attempt_questions WHERE attempt_id = ?`
    )
    .get(attemptId) as { totalScore: number; totalElapsed: number };
  db.prepare(
    `UPDATE attempts SET status = 'finished', finished_at = ?, total_score = ?, total_elapsed_ms = ? WHERE id = ?`
  ).run(now, totals.totalScore, totals.totalElapsed, attemptId);
  return getAttemptById(attemptId)!;
}

/** Every question id this player has ever been served, across all attempts (used to avoid repeats on retry). */
export function getPlayerSeenQuestionIds(playerId: string): Set<string> {
  const rows = db
    .prepare(
      `SELECT DISTINCT aq.question_id AS questionId
       FROM attempt_questions aq
       JOIN attempts a ON a.id = aq.attempt_id
       WHERE a.player_id = ?`
    )
    .all(playerId) as { questionId: string }[];
  return new Set(rows.map((r) => r.questionId));
}

export interface LeaderboardRow {
  playerId: string;
  score: number;
  elapsedMs: number;
  finishedAt: string;
  displayMode: "first_org" | "full_name" | "nickname";
  displayValue: string | null;
  firstName: string;
  lastName: string;
  organization: string;
}

/**
 * Best non-practice, finished attempt per eligible (non-hidden) player,
 * optionally scoped to one event day.
 *
 * Deliberately does NOT filter out is_test players: test data is meant to
 * behave like real play for rehearsal and for `npm run seed:demo` (so the
 * display and ranking can be checked visually before the event), and is
 * only cleaned up in bulk via the admin "wipe test data" action. is_test
 * only affects the CSV lead export, which excludes it.
 *
 * Includes each row's display-name fields so the public leaderboard can
 * show the player's chosen display name/organization without a second query.
 */
export function getLeaderboardAttempts(eventDay?: string): LeaderboardRow[] {
  const rows = db
    .prepare(
      `SELECT a.player_id AS playerId, a.total_score AS score, a.total_elapsed_ms AS elapsedMs, a.finished_at AS finishedAt,
              p.display_mode AS displayMode, p.display_value AS displayValue,
              p.first_name AS firstName, p.last_name AS lastName, p.organization AS organization
       FROM attempts a
       JOIN players p ON p.id = a.player_id
       WHERE a.status = 'finished' AND a.is_practice = 0 AND p.hidden = 0
       ${eventDay ? "AND a.event_day = ?" : ""}`
    )
    .all(...(eventDay ? [eventDay] : [])) as LeaderboardRow[];
  return rows;
}

export function getAttemptsForAdminExport(): Array<{
  playerId: string;
  bestOverallScore: number;
  attempts: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
}> {
  const rows = db
    .prepare(
      `SELECT player_id AS playerId,
              COALESCE(MAX(CASE WHEN status='finished' AND is_practice=0 THEN total_score END), 0) AS bestOverallScore,
              COUNT(CASE WHEN is_practice = 0 THEN 1 END) AS attempts,
              MIN(CASE WHEN is_practice = 0 THEN started_at END) AS firstPlayedAt,
              MAX(CASE WHEN is_practice = 0 THEN started_at END) AS lastPlayedAt
       FROM attempts
       GROUP BY player_id`
    )
    .all() as any[];
  return rows;
}
