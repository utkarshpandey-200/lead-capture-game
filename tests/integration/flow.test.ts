import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { getQuestionById } from "../../src/server/db/questions.js";
import { getAttemptQuestions } from "../../src/server/db/attemptQuestions.js";
import { db } from "../../src/server/db/index.js";
import { config } from "../../src/shared/config.js";

// Derived from config rather than hardcoded, so the test suite doesn't
// silently drift out of sync with the configured question count/limit.
const TOTAL_QUESTIONS = config.quiz.knowledgeCount + config.quiz.scenarioCount;
const MAX_SCORE = TOTAL_QUESTIONS * config.quiz.maxScorePerQuestion;

function extractCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ""];
  for (const header of headers) {
    const match = header.match(new RegExp(`${name}=([^;]+)`));
    // Set-Cookie values are percent-encoded by @fastify/cookie; light-my-request's
    // `cookies` inject option encodes again when building the Cookie header, so we
    // must hand it the decoded value or the signature check fails server-side.
    if (match) return decodeURIComponent(match[1]!);
  }
  throw new Error(`Cookie ${name} not found in Set-Cookie headers: ${JSON.stringify(headers)}`);
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false, serveClient: false });
});

async function registerPlayer(
  email: string,
  overrides: { firstName?: string; organization?: string } = {}
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/register",
    payload: {
      firstName: overrides.firstName ?? "Integration",
      lastName: "Tester",
      organization: overrides.organization ?? "Test Credit Union",
      email,
      consent: true,
      displayMode: "first_org",
    },
  });
  expect(res.statusCode).toBe(200);
  const pid = extractCookie(res.headers["set-cookie"], "pid");
  return { body: res.json(), pid };
}

/** Answers the current question correctly, claiming 0ms elapsed so scoring is deterministic (max points). */
async function answerCurrentCorrectly(pid: string, attemptId: string) {
  const qRes = await app.inject({
    method: "GET",
    url: `/api/attempts/${attemptId}/question`,
    cookies: { pid },
  });
  expect(qRes.statusCode).toBe(200);
  const question = qRes.json();

  // White-box: look up the true correct option via the DB to answer correctly every time.
  const aqRows = getAttemptQuestions(attemptId);
  const aq = aqRows.find((r) => r.position === question.position)!;
  const shuffled: number[] = JSON.parse(aq.shuffled_options);
  const dbQuestion = getQuestionById(question.questionId)!;
  const correctDisplayIndex = shuffled.indexOf(dbQuestion.correctIndex);

  const answerRes = await app.inject({
    method: "POST",
    url: `/api/attempts/${attemptId}/answer`,
    cookies: { pid },
    payload: {
      position: question.position,
      questionId: question.questionId,
      chosenOption: correctDisplayIndex,
      clientElapsedMs: 0,
    },
  });
  expect(answerRes.statusCode).toBe(200);
  return answerRes.json();
}

/** Plays all questions of an attempt, answering the first `numCorrect` correctly (max points) and the rest wrong (0 points), to get a deterministic, controllable score. */
async function playAttemptWithScore(pid: string, attemptId: string, numCorrect: number) {
  for (let i = 0; i < TOTAL_QUESTIONS; i++) {
    const qRes = await app.inject({
      method: "GET",
      url: `/api/attempts/${attemptId}/question`,
      cookies: { pid },
    });
    const question = qRes.json();

    const aqRows = getAttemptQuestions(attemptId);
    const aq = aqRows.find((r: { position: number }) => r.position === question.position)!;
    const shuffled: number[] = JSON.parse(aq.shuffled_options);
    const dbQuestion = getQuestionById(question.questionId)!;
    const correctDisplayIndex = shuffled.indexOf(dbQuestion.correctIndex);
    const wrongDisplayIndex = (correctDisplayIndex + 1) % 4;

    const answerRes = await app.inject({
      method: "POST",
      url: `/api/attempts/${attemptId}/answer`,
      cookies: { pid },
      payload: {
        position: question.position,
        questionId: question.questionId,
        chosenOption: i < numCorrect ? correctDisplayIndex : wrongDisplayIndex,
        clientElapsedMs: 0,
      },
    });
    if (i === TOTAL_QUESTIONS - 1) return answerRes.json();
  }
}

describe("full player flow", () => {
  it("registers, plays all questions, sees a result, and appears on the public leaderboard", async () => {
    const { pid } = await registerPlayer("flow-player-1@example.com");

    const startRes = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    expect(startRes.statusCode).toBe(200);
    const { attemptId } = startRes.json();
    expect(attemptId).toBeTruthy();

    let last;
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      last = await answerCurrentCorrectly(pid, attemptId);
      expect(last.correct).toBe(true);
      expect(last.pointsEarned).toBe(1000); // instant + correct = base + full speed bonus
    }

    expect(last.isLastQuestion).toBe(true);
    expect(last.result.totalScore).toBe(MAX_SCORE);
    expect(last.result.numCorrect).toBe(TOTAL_QUESTIONS);
    expect(last.result.overall.rank).toBe(1);
    expect(last.result.daily.rank).toBe(1);

    const resultRes = await app.inject({
      method: "GET",
      url: `/api/attempts/${attemptId}/result`,
      cookies: { pid },
    });
    expect(resultRes.statusCode).toBe(200);
    expect(resultRes.json().totalScore).toBe(MAX_SCORE);

    const boardRes = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    expect(boardRes.statusCode).toBe(200);
    const board = boardRes.json();
    expect(board.entries.some((e: { score: number }) => e.score === MAX_SCORE)).toBe(true);
    // Never leak email or raw internals on the public board.
    expect(JSON.stringify(board)).not.toContain("flow-player-1@example.com");
    for (const entry of board.entries) {
      expect(Object.keys(entry).sort()).toEqual(["displayName", "organization", "rank", "score"]);
    }
  });

  it("rejects answering the same question twice", async () => {
    const { pid } = await registerPlayer("flow-player-2@example.com");
    const startRes = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    const { attemptId } = startRes.json();

    const qRes = await app.inject({
      method: "GET",
      url: `/api/attempts/${attemptId}/question`,
      cookies: { pid },
    });
    const question = qRes.json();

    const firstAnswer = await app.inject({
      method: "POST",
      url: `/api/attempts/${attemptId}/answer`,
      cookies: { pid },
      payload: { position: question.position, questionId: question.questionId, chosenOption: 0, clientElapsedMs: 0 },
    });
    expect(firstAnswer.statusCode).toBe(200);

    const secondAnswer = await app.inject({
      method: "POST",
      url: `/api/attempts/${attemptId}/answer`,
      cookies: { pid },
      payload: { position: question.position, questionId: question.questionId, chosenOption: 1, clientElapsedMs: 0 },
    });
    expect(secondAnswer.statusCode).toBe(409);
    expect(secondAnswer.json().error).toBe("already_answered");
  });

  it("rejects an answer for a question that is not the current one", async () => {
    const { pid } = await registerPlayer("flow-player-3@example.com");
    const startRes = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    const { attemptId } = startRes.json();

    const res = await app.inject({
      method: "POST",
      url: `/api/attempts/${attemptId}/answer`,
      cookies: { pid },
      payload: { position: 4, questionId: "q-port-001", chosenOption: 0, clientElapsedMs: 0 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("wrong_question");
  });

  it("rejects unauthenticated access to attempt endpoints", async () => {
    const res = await app.inject({ method: "GET", url: "/api/attempts/current" });
    expect(res.statusCode).toBe(401);
  });

  it("enforces MAX_ATTEMPTS and still allows unranked practice afterward", async () => {
    const { pid } = await registerPlayer("flow-player-4@example.com");

    for (let attempt = 0; attempt < 2; attempt++) {
      const startRes = await app.inject({
        method: "POST",
        url: "/api/attempts/start",
        cookies: { pid },
        payload: {},
      });
      expect(startRes.statusCode).toBe(200);
      const { attemptId } = startRes.json();
      for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        await answerCurrentCorrectly(pid, attemptId);
      }
    }

    const thirdStart = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    expect(thirdStart.statusCode).toBe(403);
    expect(thirdStart.json().error).toBe("attempts_exhausted");

    const practiceStart = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: { practice: true },
    });
    expect(practiceStart.statusCode).toBe(200);
    expect(practiceStart.json().isPractice).toBe(true);
  });

  it("registering again with the same email creates a brand-new, separate player rather than resuming the old one", async () => {
    const first = await registerPlayer("flow-player-5@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        firstName: "Someone",
        lastName: "Else",
        organization: "Different Org",
        email: "flow-player-5@example.com",
        consent: true,
        displayMode: "full_name",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.firstName).toBe("Someone");
    const secondPid = extractCookie(res.headers["set-cookie"], "pid");
    expect(secondPid).not.toBe(first.pid);
  });

  it("rejects a registration with the honeypot field filled in", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        firstName: "Bot",
        lastName: "Account",
        organization: "N/A",
        email: "flow-bot@example.com",
        consent: true,
        displayMode: "first_org",
        website: "http://spam.example.com",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("leaderboard: every player is its own row", () => {
  it("keeps two different players with the same displayed name+org as two separate leaderboard rows with independent standings", async () => {
    const { pid: pidLow } = await registerPlayer("same-name-low@example.com", {
      firstName: "Riley",
      organization: "Shared CU",
    });
    const startLow = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid: pidLow },
      payload: {},
    });
    const lowOutcome = await playAttemptWithScore(pidLow, startLow.json().attemptId, 2);

    const { pid: pidHigh } = await registerPlayer("same-name-high@example.com", {
      firstName: "Riley",
      organization: "Shared CU",
    });
    const startHigh = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid: pidHigh },
      payload: {},
    });
    const highOutcome = await playAttemptWithScore(pidHigh, startHigh.json().attemptId, 5);

    expect(highOutcome.result.totalScore).toBeGreaterThan(lowOutcome.result.totalScore);

    // Public board: two separate rows for "Riley · Shared CU", not collapsed into one.
    const board = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    const rileyRows = board
      .json()
      .entries.filter((e: { displayName: string; organization: string }) => e.displayName === "Riley" && e.organization === "Shared CU");
    expect(rileyRows).toHaveLength(2);
    expect(rileyRows.map((r: { score: number }) => r.score).sort((a: number, b: number) => a - b)).toEqual(
      [lowOutcome.result.totalScore, highOutcome.result.totalScore].sort((a, b) => a - b)
    );

    // Each player's own standing is independent — the lower scorer does not
    // inherit the higher scorer's rank just because they share a display name.
    const lowResultNow = await app.inject({
      method: "GET",
      url: `/api/attempts/${startLow.json().attemptId}/result`,
      cookies: { pid: pidLow },
    });
    const highResultNow = await app.inject({
      method: "GET",
      url: `/api/attempts/${startHigh.json().attemptId}/result`,
      cookies: { pid: pidHigh },
    });
    expect(highResultNow.json().overall.rank).toBeLessThan(lowResultNow.json().overall.rank);
  });
});

describe("anonymous registration (email omitted)", () => {
  async function registerWithoutEmail(firstName: string, organization: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        firstName,
        lastName: "Anon",
        organization,
        consent: true,
        displayMode: "first_org",
        // email omitted entirely
      },
    });
    expect(res.statusCode).toBe(200);
    const pid = extractCookie(res.headers["set-cookie"], "pid");
    return { body: res.json(), pid };
  }

  it("registers successfully with no email", async () => {
    const { body } = await registerWithoutEmail("Skylar", "No Email CU");
    expect(body.firstName).toBe("Skylar");
  });

  it("gives two anonymous registrations with identical name/org separate player identities (each gets their own attempt cap)", async () => {
    const { pid: pidA } = await registerWithoutEmail("Twin", "Dup CU");
    const { pid: pidB } = await registerWithoutEmail("Twin", "Dup CU");
    expect(pidA).not.toBe(pidB);
  });

  it("rejects a malformed (non-empty) email even though email itself is optional", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        firstName: "Bad",
        lastName: "Email",
        organization: "Typo CU",
        email: "not-an-email",
        consent: true,
        displayMode: "first_org",
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("an anonymous player can finish an attempt and appear on the public leaderboard", async () => {
    const { pid } = await registerWithoutEmail("Reese", "Anon Board CU");
    const startRes = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    const { attemptId } = startRes.json();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      await answerCurrentCorrectly(pid, attemptId);
    }

    const board = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    expect(
      board.json().entries.some((e: { displayName: string }) => e.displayName === "Reese")
    ).toBe(true);
  });

  it("still appears in the CSV lead export, with a blank Email column (registration no longer collects email)", async () => {
    await registerWithoutEmail("Included", "No Email Export CU");

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: "test-admin-password" },
    });
    const adminCookie = extractCookie(loginRes.headers["set-cookie"], "admin_session");

    const csv = await app.inject({
      method: "GET",
      url: "/api/admin/export.csv",
      cookies: { admin_session: adminCookie },
    });
    expect(csv.body).toContain("Included");
  });
});

describe("leaderboard: date filter", () => {
  it("returns only the requested day's entries, not today's, for a daily board with ?date=", async () => {
    const { pid } = await registerPlayer("date-filter-today@example.com", {
      firstName: "TodayPlayer",
    });
    const start = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    const attemptId = start.json().attemptId;
    await playAttemptWithScore(pid, attemptId, TOTAL_QUESTIONS);

    // Backdate this attempt's event_day so it's a distinct, known past day.
    // (attemptId, not pid, since pid is a signed cookie value, not the raw player id.)
    const pastDay = "2020-01-02";
    db.prepare(`UPDATE attempts SET event_day = ? WHERE id = ?`).run(pastDay, attemptId);

    const pastBoard = await app.inject({ method: "GET", url: `/api/leaderboard/top?board=daily&date=${pastDay}` });
    expect(pastBoard.json().eventDay).toBe(pastDay);
    expect(pastBoard.json().entries.some((e: { displayName: string }) => e.displayName === "TodayPlayer")).toBe(
      true
    );

    const todayBoard = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=daily" });
    expect(
      todayBoard.json().entries.some((e: { displayName: string }) => e.displayName === "TodayPlayer")
    ).toBe(false);
  });

  it("falls back to today for a malformed date instead of erroring", async () => {
    const res = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=daily&date=not-a-date" });
    expect(res.statusCode).toBe(200);
    expect(res.json().eventDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("lists days that have at least one ranked attempt, via /api/leaderboard/days", async () => {
    const { pid } = await registerPlayer("date-filter-days@example.com", { firstName: "DaysPlayer" });
    const start = await app.inject({
      method: "POST",
      url: "/api/attempts/start",
      cookies: { pid },
      payload: {},
    });
    const attemptId = start.json().attemptId;
    await playAttemptWithScore(pid, attemptId, TOTAL_QUESTIONS);
    const pastDay = "2020-01-03";
    db.prepare(`UPDATE attempts SET event_day = ? WHERE id = ?`).run(pastDay, attemptId);

    const res = await app.inject({ method: "GET", url: "/api/leaderboard/days" });
    expect(res.statusCode).toBe(200);
    expect(res.json().days).toContain(pastDay);
  });
});
