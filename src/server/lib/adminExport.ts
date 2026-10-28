import { config } from "../../shared/config.js";
import { db } from "../db/index.js";
import { eventDayFor } from "./eventDay.js";
import { getDailyRanked, getOverallRanked } from "./standings.js";
import { toCsv } from "./csv.js";

interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
  email: string | null;
  consent_given: number;
  consent_timestamp: string;
  best_score: number;
  attempts: number;
  first_played_at: string | null;
  last_played_at: string | null;
}

/**
 * The full lead list CSV: every registered player who isn't flagged as test
 * data. The register screen no longer collects email, so the Email column
 * is typically blank — name, organization and consent are the primary
 * lead-list fields now.
 */
export function buildLeadListCsv(): string {
  const rows = db
    .prepare(
      `SELECT p.id, p.first_name, p.last_name, p.organization, p.email, p.consent_given, p.consent_timestamp,
              COALESCE(MAX(CASE WHEN a.status='finished' AND a.is_practice=0 THEN a.total_score END), 0) AS best_score,
              COUNT(CASE WHEN a.is_practice = 0 THEN 1 END) AS attempts,
              MIN(CASE WHEN a.is_practice = 0 THEN a.started_at END) AS first_played_at,
              MAX(CASE WHEN a.is_practice = 0 THEN a.started_at END) AS last_played_at
       FROM players p
       LEFT JOIN attempts a ON a.player_id = p.id
       WHERE p.is_test = 0
       GROUP BY p.id
       ORDER BY best_score DESC`
    )
    .all() as LeadRow[];

  const overallRankByPlayerId = new Map(getOverallRanked().map((e) => [e.playerId, e.rank]));
  const today = eventDayFor(new Date(), config.eventTimeZone);
  const dailyRankByPlayerId = new Map(getDailyRanked(today).map((e) => [e.playerId, e.rank]));

  const header = [
    "First name",
    "Last name",
    "Organization",
    "Email",
    "Consent given",
    "Consent timestamp",
    "Best score",
    "Overall rank",
    "Daily rank (today)",
    "Attempts",
    "First played",
    "Last played",
  ];

  const body = rows.map((r) => [
    r.first_name,
    r.last_name,
    r.organization,
    r.email,
    r.consent_given ? "yes" : "no",
    r.consent_timestamp,
    r.best_score,
    overallRankByPlayerId.get(r.id) ?? "",
    dailyRankByPlayerId.get(r.id) ?? "",
    r.attempts,
    r.first_played_at ?? "",
    r.last_played_at ?? "",
  ]);

  return toCsv([header, ...body]);
}
