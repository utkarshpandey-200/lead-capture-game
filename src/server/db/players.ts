import { db } from "./index.js";
import type { DisplayMode } from "../../shared/types.js";

export interface PlayerRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization: string;
  consent_given: number;
  consent_version: string;
  consent_timestamp: string;
  display_mode: DisplayMode;
  display_value: string | null;
  hidden: number;
  is_test: number;
  created_at: string;
}

export interface CreatePlayerInput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  consentVersion: string;
  consentTimestamp: string;
  displayMode: DisplayMode;
  displayValue: string | null;
  isTest: boolean;
}

export function createPlayer(input: CreatePlayerInput): PlayerRow {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO players (id, email, first_name, last_name, organization, consent_given, consent_version, consent_timestamp, display_mode, display_value, hidden, is_test, created_at)
     VALUES (@id, @email, @firstName, @lastName, @organization, 1, @consentVersion, @consentTimestamp, @displayMode, @displayValue, 0, @isTest, @createdAt)`
  ).run({
    id: input.id,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    organization: input.organization,
    consentVersion: input.consentVersion,
    consentTimestamp: input.consentTimestamp,
    displayMode: input.displayMode,
    displayValue: input.displayValue,
    isTest: input.isTest ? 1 : 0,
    createdAt: now,
  });
  return getPlayerById(input.id)!;
}

export function getPlayerByEmail(email: string): PlayerRow | undefined {
  return db.prepare(`SELECT * FROM players WHERE email = ?`).get(email) as PlayerRow | undefined;
}

export function getPlayerById(id: string): PlayerRow | undefined {
  return db.prepare(`SELECT * FROM players WHERE id = ?`).get(id) as PlayerRow | undefined;
}

export function updateDisplayPreference(
  id: string,
  displayMode: DisplayMode,
  displayValue: string | null
): void {
  db.prepare(`UPDATE players SET display_mode = ?, display_value = ? WHERE id = ?`).run(
    displayMode,
    displayValue,
    id
  );
}

export function updateConsent(id: string, consentVersion: string, consentTimestamp: string): void {
  db.prepare(
    `UPDATE players SET consent_given = 1, consent_version = ?, consent_timestamp = ? WHERE id = ?`
  ).run(consentVersion, consentTimestamp, id);
}

export function setPlayerHidden(id: string, hidden: boolean): void {
  db.prepare(`UPDATE players SET hidden = ? WHERE id = ?`).run(hidden ? 1 : 0, id);
}

export function setPlayerTestFlag(id: string, isTest: boolean): void {
  db.prepare(`UPDATE players SET is_test = ? WHERE id = ?`).run(isTest ? 1 : 0, id);
}

export function deletePlayerCascade(id: string): void {
  const run = db.transaction((playerId: string) => {
    const attemptIds = db
      .prepare(`SELECT id FROM attempts WHERE player_id = ?`)
      .all(playerId) as { id: string }[];
    for (const { id: attemptId } of attemptIds) {
      db.prepare(`DELETE FROM attempt_questions WHERE attempt_id = ?`).run(attemptId);
    }
    db.prepare(`DELETE FROM attempts WHERE player_id = ?`).run(playerId);
    db.prepare(`DELETE FROM players WHERE id = ?`).run(playerId);
  });
  run(id);
}

/** Deletes every player flagged as test data, and all of their attempts/answers. */
export function wipeTestData(): { playersDeleted: number } {
  const testPlayers = db.prepare(`SELECT id FROM players WHERE is_test = 1`).all() as {
    id: string;
  }[];
  for (const { id } of testPlayers) {
    deletePlayerCascade(id);
  }
  return { playersDeleted: testPlayers.length };
}

export interface AdminPlayerListParams {
  search?: string;
  sortBy?: "name" | "organization" | "email" | "best_score" | "attempts" | "last_played" | "consent";
  sortDir?: "asc" | "desc";
}

export interface AdminPlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  organization: string;
  email: string;
  bestScore: number;
  attempts: number;
  lastPlayedAt: string | null;
  firstPlayedAt: string | null;
  consentGiven: boolean;
  consentTimestamp: string;
  hidden: boolean;
  isTest: boolean;
  createdAt: string;
}

export function listPlayersForAdmin(params: AdminPlayerListParams): AdminPlayerRow[] {
  const search = params.search?.trim().toLowerCase();
  const rows = db
    .prepare(
      `SELECT p.*,
         COALESCE(MAX(CASE WHEN a.status='finished' AND a.is_practice=0 THEN a.total_score END), 0) AS best_score,
         COUNT(CASE WHEN a.is_practice=0 THEN 1 END) AS attempts,
         MIN(CASE WHEN a.is_practice=0 THEN a.started_at END) AS first_played_at,
         MAX(CASE WHEN a.is_practice=0 THEN a.started_at END) AS last_played_at
       FROM players p
       LEFT JOIN attempts a ON a.player_id = p.id
       GROUP BY p.id`
    )
    .all() as any[];

  let mapped: AdminPlayerRow[] = rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    organization: r.organization,
    email: r.email,
    bestScore: r.best_score,
    attempts: r.attempts,
    lastPlayedAt: r.last_played_at,
    firstPlayedAt: r.first_played_at,
    consentGiven: !!r.consent_given,
    consentTimestamp: r.consent_timestamp,
    hidden: !!r.hidden,
    isTest: !!r.is_test,
    createdAt: r.created_at,
  }));

  if (search) {
    mapped = mapped.filter(
      (p) =>
        p.firstName.toLowerCase().includes(search) ||
        p.lastName.toLowerCase().includes(search) ||
        p.organization.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search)
    );
  }

  const sortBy = params.sortBy ?? "last_played";
  const dir = params.sortDir === "asc" ? 1 : -1;
  const keyFor = (p: AdminPlayerRow): string | number => {
    switch (sortBy) {
      case "name":
        return `${p.firstName} ${p.lastName}`.toLowerCase();
      case "organization":
        return p.organization.toLowerCase();
      case "email":
        return p.email;
      case "best_score":
        return p.bestScore;
      case "attempts":
        return p.attempts;
      case "consent":
        return p.consentGiven ? 1 : 0;
      case "last_played":
      default:
        return p.lastPlayedAt ?? "";
    }
  };
  mapped.sort((a, b) => {
    const ka = keyFor(a);
    const kb = keyFor(b);
    if (ka < kb) return -1 * dir;
    if (ka > kb) return 1 * dir;
    return 0;
  });

  return mapped;
}
