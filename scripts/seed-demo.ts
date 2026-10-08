/**
 * Creates ~150 fake players with varied scores so the display and
 * leaderboard can be checked visually before the event. Every player this
 * script creates is flagged is_test=true, so they behave like real plays
 * (they show up on /display and /play rankings) but can be wiped in one
 * action from /admin ("Wipe test data").
 *
 * Run with: npm run seed:demo
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { db } from "../src/server/db/index.js";
import { loadQuestionsFromSeedFile } from "../src/server/db/questions.js";
import { createPlayer } from "../src/server/db/players.js";
import { createAttempt, finalizeAttempt } from "../src/server/db/attempts.js";
import { createAttemptQuestions, recordAnswer, getAttemptQuestions } from "../src/server/db/attemptQuestions.js";
import { getQuestionPool } from "../src/server/db/questions.js";
import { selectQuestionsForAttempt } from "../src/server/lib/questionSelection.js";
import { shuffleOptionIndices } from "../src/server/lib/shuffle.js";
import { computePoints } from "../src/shared/scoring.js";
import { eventDayFor } from "../src/server/lib/eventDay.js";
import { config } from "../src/shared/config.js";
import { newId } from "../src/server/lib/ids.js";

const FIRST_NAMES = [
  "Jordan", "Casey", "Morgan", "Taylor", "Riley", "Avery", "Quinn", "Reese", "Rowan", "Skyler",
  "Hayden", "Emerson", "Finley", "Parker", "Dakota", "Sawyer", "Elliot", "Kendall", "Blake", "Peyton",
  "Jamie", "Cameron", "Drew", "Marlowe", "Shiloh", "Tatum", "Remy", "Sage", "Harper", "Lane",
];

const LAST_NAMES = [
  "Nguyen", "Garcia", "Patel", "Kim", "Smith", "Johnson", "Brown", "Davis", "Martinez", "Lopez",
  "Lee", "Walker", "Hall", "Young", "King", "Wright", "Scott", "Torres", "Nelson", "Carter",
];

const ORGANIZATIONS = [
  "Acme Credit Union", "Northwind FCU", "Lakeside Credit Union", "Summit Financial CU",
  "Harbor Point CU", "Cascade Federal CU", "Meridian Credit Union", "Granite State FCU",
  "Bluegrass Community CU", "Prairie Trust CU", "Riverside FCU", "Evergreen Credit Union",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  // Make sure the question pool exists (fresh clones won't have run the server yet).
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM questions`).get() as { n: number };
  if (existing.n === 0) {
    loadQuestionsFromSeedFile(fileURLToPath(new URL("../data/questions.seed.json", import.meta.url)));
  }

  const pool = getQuestionPool(true); // include drafts so this works before fact-checking is done
  if (pool.length < config.quiz.knowledgeCount + config.quiz.scenarioCount) {
    throw new Error("Not enough questions in the pool to seed demo attempts.");
  }

  const PLAYER_COUNT = 150;
  const today = eventDayFor(new Date(), config.eventTimeZone);
  const yesterday = eventDayFor(new Date(Date.now() - 24 * 60 * 60 * 1000), config.eventTimeZone);
  const twoDaysAgo = eventDayFor(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), config.eventTimeZone);

  let created = 0;

  for (let i = 0; i < PLAYER_COUNT; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const email = `demo.${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@example.com`;
    const displayRoll = Math.random();
    const displayMode = displayRoll < 0.6 ? "first_org" : displayRoll < 0.85 ? "full_name" : "nickname";

    const player = createPlayer({
      id: newId(),
      email,
      firstName,
      lastName,
      organization: pick(ORGANIZATIONS),
      consentVersion: config.consentVersion,
      consentTimestamp: new Date().toISOString(),
      displayMode,
      displayValue: displayMode === "nickname" ? `${firstName}${randomInt(10, 99)}` : null,
      isTest: true,
    });

    // 70% played "today", 20% yesterday, 10% two days ago — so Overall and
    // Daily visibly differ when checking the display.
    const dayRoll = Math.random();
    const eventDay = dayRoll < 0.7 ? today : dayRoll < 0.9 ? yesterday : twoDaysAgo;

    const attemptId = newId();
    const attempt = createAttempt(attemptId, player.id, eventDay, false);

    const selected = selectQuestionsForAttempt(
      pool,
      new Set(),
      config.quiz.knowledgeCount,
      config.quiz.scenarioCount
    );
    createAttemptQuestions(
      attemptId,
      selected.map((q, position) => ({
        id: newId(),
        questionId: q.id,
        position,
        shuffledOptions: shuffleOptionIndices(),
      }))
    );

    // Give each fake player a consistent "skill level" so scores form a
    // believable spread instead of pure noise.
    const skill = Math.random(); // 0 = weak, 1 = sharp
    const rows = getAttemptQuestions(attemptId);
    for (const row of rows) {
      const question = pool.find((q) => q.id === row.question_id)!;
      const correct = Math.random() < 0.35 + skill * 0.6;
      const elapsedMs = correct
        ? randomInt(1000, Math.round(config.quiz.questionTimeLimitMs * (1.1 - skill * 0.7)))
        : randomInt(3000, config.quiz.questionTimeLimitMs);
      const points = computePoints(correct, elapsedMs, {
        basePoints: config.quiz.basePoints,
        speedBonusPoints: config.quiz.speedBonusPoints,
        limitMs: config.quiz.questionTimeLimitMs,
      });
      recordAnswer(row.id, {
        answeredAt: new Date().toISOString(),
        chosenOption: correct ? JSON.parse(row.shuffled_options).indexOf(question.correctIndex) : randomInt(0, 3),
        correct,
        elapsedMs,
        points,
      });
    }

    finalizeAttempt(attemptId);
    void attempt;
    created++;
  }

  console.log(`Seeded ${created} demo players (flagged is_test) across today/yesterday/2-days-ago.`);
  console.log(`Remove them any time from /admin -> Players -> "Wipe test data".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
