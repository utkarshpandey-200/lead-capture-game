/**
 * Single source of truth for branding, copy, timing and limits.
 * Every value here can be overridden by an environment variable of the
 * same name. This module is imported by the server only; the client
 * receives the public subset via GET /api/config so a rebuild isn't
 * needed to change copy or timing before the event.
 */

function envStr(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === "true" || v === "1";
}

// Pulled out so questionsPerAttempt (a display-only value — selection itself
// is driven directly by knowledgeCount/scenarioCount) can be derived from the
// same numbers rather than configured separately, which can drift out of sync.
const quizKnowledgeCount = envInt("QUIZ_KNOWLEDGE_COUNT", 3);
const quizScenarioCount = envInt("QUIZ_SCENARIO_COUNT", 0);

export const config = {
  // Branding — colors and logo pulled from precisioncuso.org's live design
  // system (navy/blue/gold palette, DM Sans typeface). Swap BRAND_LOGO_PATH
  // and the three color vars if the real brand kit ever changes.
  brand: {
    name: envStr("BRAND_NAME", "Precision CUSO"),
    logoPath: envStr("BRAND_LOGO_PATH", "/brand/precision-cuso-logo.webp"),
    primaryColor: envStr("BRAND_PRIMARY_COLOR", "#072559"),
    secondaryColor: envStr("BRAND_SECONDARY_COLOR", "#F5B731"),
    accentColor: envStr("BRAND_ACCENT_COLOR", "#0F8B4C"),
  },

  // Copy
  copy: {
    quizTitle: envStr("QUIZ_TITLE", "Credit Union Quiz"),
    introHeadline: envStr(
      "INTRO_HEADLINE",
      "How fast and how well do you know about the Credit Union movement?"
    ),
    introBody: envStr(
      "INTRO_BODY",
      "Answer 3 quick questions about Credit Union movement. You're scored on accuracy and speed."
    ),
    consentText: envStr(
      "CONSENT_TEXT",
      "I agree to be contacted by Precision CUSO about this quiz and related information."
    ),
  },

  // Consent version — bump this if consentText changes meaningfully.
  consentVersion: envStr("CONSENT_VERSION", "2026-10-v1"),

  // Links
  links: {
    privacyPolicyUrl: envStr(
      "PRIVACY_POLICY_URL",
      "https://www.precisioncuso.com/privacy"
    ),
    bookingUrl: envStr(
      "BOOKING_URL",
      "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1on6Qya4-DTxrA7fu64uLFM6JEUeHQ_pY2rIsXUXdMUJtapL5e5wP6VJaw9L2qCSN9MtRzwTlV"
    ),
    playBaseUrl: envStr("PLAY_BASE_URL", "https://quiz.precisioncuso.com"),
    websiteUrl: envStr("WEBSITE_URL", "https://precisioncuso.org"),
  },

  // Quiz mechanics
  quiz: {
    knowledgeCount: quizKnowledgeCount,
    scenarioCount: quizScenarioCount,
    questionsPerAttempt: quizKnowledgeCount + quizScenarioCount,
    questionTimeLimitMs: envInt("QUESTION_TIME_LIMIT_MS", 20000),
    maxAttempts: envInt("MAX_ATTEMPTS", 2),
    maxScorePerQuestion: 1000,
    basePoints: 500,
    speedBonusPoints: 500,
    resultIdleTimeoutMs: envInt("KIOSK_IDLE_TIMEOUT_MS", 45000),
    clientTimingToleranceMs: envInt("CLIENT_TIMING_TOLERANCE_MS", 3000),
  },

  // Display screen
  display: {
    pollIntervalMs: envInt("DISPLAY_POLL_INTERVAL_MS", 3000),
    topN: envInt("DISPLAY_TOP_N", 5),
  },

  // Time zone used for the "day" boundary on the Daily leaderboard
  eventTimeZone: envStr("EVENT_TIMEZONE", "America/Los_Angeles"),

  // Flags
  flags: {
    allowDraftQuestions: envBool("ALLOW_DRAFT_QUESTIONS", false),
  },

  // Server / infra
  server: {
    port: envInt("PORT", 8080),
    sessionSecret: envStr(
      "SESSION_SECRET",
      "dev-insecure-secret-change-me-before-deploy"
    ),
    sessionTtlMs: envInt("SESSION_TTL_MS", 3 * 24 * 60 * 60 * 1000),
    databasePath: envStr("DATABASE_PATH", "./data/quiz.sqlite"),
    adminPassword: envStr("ADMIN_PASSWORD", ""),
    adminSessionTtlMs: envInt("ADMIN_SESSION_TTL_MS", 12 * 60 * 60 * 1000),
    corsOrigin: envStr("CORS_ORIGIN", ""),
    trustProxy: envBool("TRUST_PROXY", true),
  },

  // Rate limits (requests per 1-minute window). Defaults are sized for booth
  // abuse-prevention; raised in the test env (see vitest.config.ts) so the
  // test suite's own request volume never trips production-sized limits.
  rateLimits: {
    globalMax: envInt("RATE_LIMIT_GLOBAL_MAX", 120),
    registerMax: envInt("RATE_LIMIT_REGISTER_MAX", 8),
    answerMax: envInt("RATE_LIMIT_ANSWER_MAX", 60),
    adminLoginMax: envInt("RATE_LIMIT_ADMIN_LOGIN_MAX", 10),
  },

  // Profanity blocklist for nicknames (kept short and conservative on purpose)
  nicknameBlocklist: [
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "bastard",
    "cunt",
    "dick",
    "piss",
    "slut",
    "whore",
    "nigger",
    "nigga",
    "fag",
    "retard",
    "rape",
    "nazi",
  ],
};

export type AppConfig = typeof config;

/** Public-safe subset served to the client via GET /api/config */
export function getPublicConfig() {
  return {
    brand: config.brand,
    copy: config.copy,
    consentVersion: config.consentVersion,
    links: config.links,
    quiz: {
      questionsPerAttempt: config.quiz.questionsPerAttempt,
      questionTimeLimitMs: config.quiz.questionTimeLimitMs,
      maxAttempts: config.quiz.maxAttempts,
      maxScorePerQuestion: config.quiz.maxScorePerQuestion,
      resultIdleTimeoutMs: config.quiz.resultIdleTimeoutMs,
    },
    display: config.display,
    nicknameBlocklist: config.nicknameBlocklist,
  };
}

export type PublicConfig = ReturnType<typeof getPublicConfig>;
