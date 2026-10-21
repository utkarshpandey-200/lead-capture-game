import { config } from "../../shared/config.js";
import { db } from "../db/index.js";
import { eventDayFor } from "./eventDay.js";
import { getDailyRanked, getOverallRanked, groupKeyForPlayer } from "./standings.js";
import { toCsv } from "./csv.js";

interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  organization: string;
  email: string;
  consent_given: number;
  consent_timestamp: string;
  best_score: number;
  attempts: number;
  first_played_at: string | null;
  last_played_at: string | null;
}

/**
 * The full lead list CSV: every registered player who isn't flagged as test
 * data AND provided an email (an anonymous player — email was optional at
 * registration — has nothing a lead list could contact them with).
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
       WHERE p.is_test = 0 AND p.email IS NOT NULL
       GROUP BY p.id
       ORDER BY best_score DESC`
    )
    .all() as LeadRow[];

  // Ranked entries are deduped by displayed identity (see standings.ts), so
  // a player whose own attempt didn't win their display-name group won't
  // appear by their own playerId — look them up by that shared group key
  // instead, same as an individual player's own standing does.
  const overallRankByGroupKey = new Map(getOverallRanked().map((e) => [e.groupKey ?? e.playerId, e.rank]));
  const today = eventDayFor(new Date(), config.eventTimeZone);
  const dailyRankByGroupKey = new Map(getDailyRanked(today).map((e) => [e.groupKey ?? e.playerId, e.rank]));

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

  const body = rows.map((r) => {
    const groupKey = groupKeyForPlayer(r.id);
    return [
      r.first_name,
      r.last_name,
      r.organization,
      r.email,
      r.consent_given ? "yes" : "no",
      r.consent_timestamp,
      r.best_score,
      groupKey != null ? (overallRankByGroupKey.get(groupKey) ?? "") : "",
      groupKey != null ? (dailyRankByGroupKey.get(groupKey) ?? "") : "",
      r.attempts,
      r.first_played_at ?? "",
      r.last_played_at ?? "",
    ];
  });

  return toCsv([header, ...body]);
}
