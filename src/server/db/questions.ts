import fs from "node:fs";
import { db } from "./index.js";
import type { QuestionSeed } from "../../shared/types.js";

const upsertStmt = db.prepare(`
  INSERT INTO questions (id, category, type, difficulty, prompt, options, correct_index, explanation, reference, status, created_at)
  VALUES (@id, @category, @type, @difficulty, @prompt, @options, @correctIndex, @explanation, @reference, @status, @createdAt)
  ON CONFLICT(id) DO UPDATE SET
    category = excluded.category,
    type = excluded.type,
    difficulty = excluded.difficulty,
    prompt = excluded.prompt,
    options = excluded.options,
    correct_index = excluded.correct_index,
    explanation = excluded.explanation,
    reference = excluded.reference,
    status = excluded.status
`);

function validateSeed(q: QuestionSeed): void {
  if (!q.id || !q.prompt || !q.category) {
    throw new Error(`Question missing required fields: ${JSON.stringify(q)}`);
  }
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`Question ${q.id} must have exactly 4 options`);
  }
  if (q.correctIndex < 0 || q.correctIndex > 3) {
    throw new Error(`Question ${q.id} correctIndex out of range`);
  }
  if (q.type !== "knowledge" && q.type !== "scenario") {
    throw new Error(`Question ${q.id} has invalid type: ${q.type}`);
  }
  if (q.status !== "draft" && q.status !== "approved") {
    throw new Error(`Question ${q.id} has invalid status: ${q.status}`);
  }
}

/** Upserts questions by id. Used at server boot and by the admin JSON import tool. */
export function upsertQuestions(questions: QuestionSeed[]): { count: number } {
  const now = new Date().toISOString();
  const run = db.transaction((items: QuestionSeed[]) => {
    for (const q of items) {
      validateSeed(q);
      upsertStmt.run({
        id: q.id,
        category: q.category,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        reference: q.reference ?? "",
        status: q.status,
        createdAt: now,
      });
    }
  });
  run(questions);
  return { count: questions.length };
}

export function loadQuestionsFromSeedFile(filePath: string): { count: number } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as QuestionSeed[];
  return upsertQuestions(parsed);
}

export interface QuestionRow {
  id: string;
  category: string;
  type: "knowledge" | "scenario";
  difficulty: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  reference: string;
  status: "draft" | "approved";
}

function rowToQuestion(row: any): QuestionRow {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    difficulty: row.difficulty,
    prompt: row.prompt,
    options: JSON.parse(row.options),
    correctIndex: row.correct_index,
    explanation: row.explanation,
    reference: row.reference ?? "",
    status: row.status,
  };
}

export function getQuestionPool(includeDrafts: boolean): QuestionRow[] {
  const statuses = includeDrafts ? ["draft", "approved"] : ["approved"];
  const placeholders = statuses.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM questions WHERE status IN (${placeholders})`)
    .all(...statuses);
  return rows.map(rowToQuestion);
}

export function getQuestionById(id: string): QuestionRow | undefined {
  const row = db.prepare(`SELECT * FROM questions WHERE id = ?`).get(id);
  return row ? rowToQuestion(row as any) : undefined;
}

export function getAllQuestionsForAdmin(): QuestionRow[] {
  const rows = db.prepare(`SELECT * FROM questions ORDER BY category, id`).all();
  return rows.map(rowToQuestion);
}

export function setQuestionStatus(id: string, status: "draft" | "approved"): void {
  db.prepare(`UPDATE questions SET status = ? WHERE id = ?`).run(status, id);
}
