import { db } from "./index.js";

export interface AttemptQuestionRow {
  id: string;
  attempt_id: string;
  position: number;
  question_id: string;
  shuffled_options: string; // JSON array of original option indices, in displayed order
  served_at: string | null;
  answered_at: string | null;
  chosen_option: number | null;
  correct: number | null;
  elapsed_ms: number | null;
  points: number | null;
}

export interface NewAttemptQuestion {
  id: string;
  questionId: string;
  position: number;
  shuffledOptions: number[];
}

export function createAttemptQuestions(attemptId: string, items: NewAttemptQuestion[]): void {
  const stmt = db.prepare(
    `INSERT INTO attempt_questions (id, attempt_id, position, question_id, shuffled_options)
     VALUES (?, ?, ?, ?, ?)`
  );
  const run = db.transaction((rows: NewAttemptQuestion[]) => {
    for (const row of rows) {
      stmt.run(row.id, attemptId, row.position, row.questionId, JSON.stringify(row.shuffledOptions));
    }
  });
  run(items);
}

export function getAttemptQuestions(attemptId: string): AttemptQuestionRow[] {
  return db
    .prepare(`SELECT * FROM attempt_questions WHERE attempt_id = ? ORDER BY position ASC`)
    .all(attemptId) as AttemptQuestionRow[];
}

export function getAttemptQuestionByPosition(
  attemptId: string,
  position: number
): AttemptQuestionRow | undefined {
  return db
    .prepare(`SELECT * FROM attempt_questions WHERE attempt_id = ? AND position = ?`)
    .get(attemptId, position) as AttemptQuestionRow | undefined;
}

export function getCurrentAttemptQuestion(attemptId: string): AttemptQuestionRow | undefined {
  return db
    .prepare(
      `SELECT * FROM attempt_questions WHERE attempt_id = ? AND answered_at IS NULL ORDER BY position ASC LIMIT 1`
    )
    .get(attemptId) as AttemptQuestionRow | undefined;
}

export function markServedIfNeeded(id: string): string {
  const row = db.prepare(`SELECT served_at FROM attempt_questions WHERE id = ?`).get(id) as {
    served_at: string | null;
  };
  if (row.served_at) return row.served_at;
  const now = new Date().toISOString();
  db.prepare(`UPDATE attempt_questions SET served_at = ? WHERE id = ?`).run(now, id);
  return now;
}

export function recordAnswer(
  id: string,
  data: {
    answeredAt: string;
    chosenOption: number | null;
    correct: boolean;
    elapsedMs: number;
    points: number;
  }
): void {
  db.prepare(
    `UPDATE attempt_questions SET answered_at = ?, chosen_option = ?, correct = ?, elapsed_ms = ?, points = ? WHERE id = ?`
  ).run(data.answeredAt, data.chosenOption, data.correct ? 1 : 0, data.elapsedMs, data.points, id);
}
