import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { getQuestionById } from "../../src/server/db/questions.js";
import { getAttemptQuestions } from "../../src/server/db/attemptQuestions.js";

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

async function registerPlayer(email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/register",
    payload: {
      firstName: "Integration",
      lastName: "Tester",
      organization: "Test Credit Union",
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

describe("full player flow", () => {
  it("registers, plays 5 questions, sees a result, and appears on the public leaderboard", async () => {
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
    for (let i = 0; i < 5; i++) {
      last = await answerCurrentCorrectly(pid, attemptId);
      expect(last.correct).toBe(true);
      expect(last.pointsEarned).toBe(1000); // instant + correct = base + full speed bonus
    }

    expect(last.isLastQuestion).toBe(true);
    expect(last.result.totalScore).toBe(5000);
    expect(last.result.numCorrect).toBe(5);
    expect(last.result.overall.rank).toBe(1);
    expect(last.result.daily.rank).toBe(1);

    const resultRes = await app.inject({
      method: "GET",
      url: `/api/attempts/${attemptId}/result`,
      cookies: { pid },
    });
    expect(resultRes.statusCode).toBe(200);
    expect(resultRes.json().totalScore).toBe(5000);

    const boardRes = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    expect(boardRes.statusCode).toBe(200);
    const board = boardRes.json();
    expect(board.entries.some((e: { score: number }) => e.score === 5000)).toBe(true);
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
      for (let i = 0; i < 5; i++) {
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

  it("does not reveal stored personal details when an existing email registers again", async () => {
    await registerPlayer("flow-player-5@example.com");

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
    expect(body.isReturning).toBe(true);
    expect(body.message).toBeTruthy();
    expect(body).not.toHaveProperty("firstName");
    expect(body).not.toHaveProperty("lastName");
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
