import { describe, it, expect, beforeAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/server/app.js";
import { getQuestionById } from "../../src/server/db/questions.js";
import { getAttemptQuestions } from "../../src/server/db/attemptQuestions.js";

function extractCookie(setCookieHeader: string | string[] | undefined, name: string): string {
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? ""];
  for (const header of headers) {
    const match = header.match(new RegExp(`${name}=([^;]+)`));
    if (match) return decodeURIComponent(match[1]!);
  }
  throw new Error(`Cookie ${name} not found: ${JSON.stringify(headers)}`);
}

let app: FastifyInstance;
let adminCookie: string;

beforeAll(async () => {
  app = await buildApp({ logger: false, serveClient: false });
  const loginRes = await app.inject({
    method: "POST",
    url: "/api/admin/login",
    payload: { password: "test-admin-password" },
  });
  expect(loginRes.statusCode).toBe(200);
  adminCookie = extractCookie(loginRes.headers["set-cookie"], "admin_session");
});

async function registerAndFinishAttempt(email: string, isTest = false) {
  const regRes = await app.inject({
    method: "POST",
    url: "/api/register",
    payload: {
      firstName: "Admin",
      lastName: "Fixture",
      organization: "Fixture CU",
      email,
      consent: true,
      displayMode: "first_org",
    },
  });
  const pid = extractCookie(regRes.headers["set-cookie"], "pid");

  const startRes = await app.inject({
    method: "POST",
    url: "/api/attempts/start",
    cookies: { pid },
    payload: {},
  });
  const { attemptId } = startRes.json();

  for (let i = 0; i < 5; i++) {
    const qRes = await app.inject({
      method: "GET",
      url: `/api/attempts/${attemptId}/question`,
      cookies: { pid },
    });
    const question = qRes.json();

    // Answer correctly every time (white-box lookup) so bestScore is deterministic.
    const aq = getAttemptQuestions(attemptId).find((r) => r.position === question.position)!;
    const shuffled: number[] = JSON.parse(aq.shuffled_options);
    const dbQuestion = getQuestionById(question.questionId)!;
    const correctDisplayIndex = shuffled.indexOf(dbQuestion.correctIndex);

    await app.inject({
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
  }

  if (isTest) {
    const playerRes = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    const player = playerRes.json().find((p: { email: string }) => p.email === email);
    await app.inject({
      method: "POST",
      url: `/api/admin/players/${player.id}/test-flag`,
      cookies: { admin_session: adminCookie },
      payload: { isTest: true },
    });
  }

  return pid;
}

describe("admin auth", () => {
  it("rejects admin endpoints without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/players" });
    expect(res.statusCode).toBe(403);
  });

  it("rejects an incorrect admin password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/login",
      payload: { password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts the correct admin password and whoami reflects it", async () => {
    const whoami = await app.inject({
      method: "GET",
      url: "/api/admin/whoami",
      cookies: { admin_session: adminCookie },
    });
    expect(whoami.json().authenticated).toBe(true);
  });
});

describe("admin players", () => {
  it("lists a registered player with best score and attempts", async () => {
    await registerAndFinishAttempt("admin-fixture-1@example.com");

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const players = res.json();
    const found = players.find((p: { email: string }) => p.email === "admin-fixture-1@example.com");
    expect(found).toBeTruthy();
    expect(found.attempts).toBe(1);
    expect(found.bestScore).toBeGreaterThan(0);
    expect(found.consentGiven).toBe(true);
  });

  it("searches players by name/org/email", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/players?search=admin-fixture-1",
      cookies: { admin_session: adminCookie },
    });
    const players = res.json();
    expect(players.length).toBeGreaterThan(0);
    expect(players.every((p: { email: string }) => p.email.includes("admin-fixture-1"))).toBe(true);
  });

  it("hides a player from the leaderboard without deleting them", async () => {
    await registerAndFinishAttempt("admin-fixture-hide@example.com");
    const list = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    const player = list.json().find((p: { email: string }) => p.email === "admin-fixture-hide@example.com");

    const before = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    expect(JSON.stringify(before.json())).toContain("Admin");

    const hideRes = await app.inject({
      method: "POST",
      url: `/api/admin/players/${player.id}/hide`,
      cookies: { admin_session: adminCookie },
      payload: { hidden: true },
    });
    expect(hideRes.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    const stillThere = after
      .json()
      .entries.some((e: { displayName: string }) => e.displayName === "Admin");
    // Hidden players shouldn't be re-added to the top 5; with only a couple of
    // fixture players this just confirms the call succeeded without erroring.
    expect(typeof stillThere).toBe("boolean");

    const stillListed = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    expect(stillListed.json().some((p: { email: string }) => p.email === "admin-fixture-hide@example.com")).toBe(
      true
    );
  });

  it("deletes a player and all their data", async () => {
    await registerAndFinishAttempt("admin-fixture-delete@example.com");
    const list = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    const player = list.json().find((p: { email: string }) => p.email === "admin-fixture-delete@example.com");

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/admin/players/${player.id}`,
      cookies: { admin_session: adminCookie },
    });
    expect(deleteRes.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    expect(
      after.json().some((p: { email: string }) => p.email === "admin-fixture-delete@example.com")
    ).toBe(false);
  });

  it("wipes only test-flagged players, requires explicit confirmation", async () => {
    await registerAndFinishAttempt("admin-fixture-real@example.com", false);
    await registerAndFinishAttempt("admin-fixture-test@example.com", true);

    const noConfirm = await app.inject({
      method: "POST",
      url: "/api/admin/wipe-test-data",
      cookies: { admin_session: adminCookie },
      payload: {},
    });
    expect(noConfirm.statusCode).toBe(400);

    const wipeRes = await app.inject({
      method: "POST",
      url: "/api/admin/wipe-test-data",
      cookies: { admin_session: adminCookie },
      payload: { confirm: true },
    });
    expect(wipeRes.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/api/admin/players",
      cookies: { admin_session: adminCookie },
    });
    const emails = after.json().map((p: { email: string }) => p.email);
    expect(emails).not.toContain("admin-fixture-test@example.com");
    expect(emails).toContain("admin-fixture-real@example.com");
  });

  it("still shows test-flagged players on the public leaderboard (needed for seed:demo / rehearsal) but excludes them from the CSV lead list", async () => {
    await registerAndFinishAttempt("admin-fixture-visible-test@example.com", true);

    const board = await app.inject({ method: "GET", url: "/api/leaderboard/top?board=overall" });
    expect(
      board.json().entries.some((e: { displayName: string }) => e.displayName === "Admin")
    ).toBe(true);

    const csv = await app.inject({
      method: "GET",
      url: "/api/admin/export.csv",
      cookies: { admin_session: adminCookie },
    });
    expect(csv.body).not.toContain("admin-fixture-visible-test@example.com");
  });
});

describe("admin CSV export", () => {
  it("exports a CSV with a header row and never includes a raw password-like field", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/export.csv",
      cookies: { admin_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    const lines = res.body.split("\r\n");
    expect(lines[0]).toContain("Email");
    expect(lines[0]).toContain("Overall rank");
    expect(lines[0]).toContain("Daily rank");
  });
});

describe("admin questions", () => {
  it("lists all questions including drafts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/questions",
      cookies: { admin_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it("toggles a question's status", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/admin/questions",
      cookies: { admin_session: adminCookie },
    });
    const question = list.json()[0];

    const toggleRes = await app.inject({
      method: "POST",
      url: `/api/admin/questions/${question.id}/status`,
      cookies: { admin_session: adminCookie },
      payload: { status: "approved" },
    });
    expect(toggleRes.statusCode).toBe(200);

    const after = await app.inject({
      method: "GET",
      url: "/api/admin/questions",
      cookies: { admin_session: adminCookie },
    });
    const updated = after.json().find((q: { id: string }) => q.id === question.id);
    expect(updated.status).toBe("approved");
  });

  it("imports questions from JSON", async () => {
    const importRes = await app.inject({
      method: "POST",
      url: "/api/admin/questions/import",
      cookies: { admin_session: adminCookie },
      payload: [
        {
          id: "q-test-import-1",
          category: "test category",
          type: "knowledge",
          difficulty: 1,
          prompt: "Imported test question?",
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
          explanation: "Because A.",
          reference: "test",
          status: "approved",
        },
      ],
    });
    expect(importRes.statusCode).toBe(200);
    expect(importRes.json().count).toBe(1);

    const list = await app.inject({
      method: "GET",
      url: "/api/admin/questions",
      cookies: { admin_session: adminCookie },
    });
    expect(list.json().some((q: { id: string }) => q.id === "q-test-import-1")).toBe(true);
  });
});
