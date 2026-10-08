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

export const config = {
  // Branding
  brand: {
    name: envStr("BRAND_NAME", "Precision CUSO"),
    logoPath: envStr("BRAND_LOGO_PATH", "/brand/logo-placeholder.svg"),
    primaryColor: envStr("BRAND_PRIMARY_COLOR", "#1C3D5A"),
    secondaryColor: envStr("BRAND_SECONDARY_COLOR", "#F2A71B"),
    accentColor: envStr("BRAND_ACCENT_COLOR", "#2E9E6B"),
  },

  // Copy
  copy: {
    quizTitle: envStr("QUIZ_TITLE", "The AI-in-Lending Speed Quiz"),
    introHeadline: envStr(
      "INTRO_HEADLINE",
      "How fast — and how well — do you know AI in lending?"
    ),
    introBody: envStr(
      "INTRO_BODY",
      "Answer 5 quick questions on AI-driven credit decisioning. You're scored on accuracy and speed. Top 5 scores are shown live at the booth."
    ),
    boothCta: envStr("BOOTH_CTA", "Scan to play. Top 5 are shown here."),
    consentText: envStr(
      "CONSENT_TEXT",
      "I agree to be contacted by Precision CUSO about this quiz and related information."
    ),
    welcomeBackText: envStr("WELCOME_BACK_TEXT", "Welcome back"),
  },

  // Consent version — bump this if consentText changes meaningfully.
  consentVersion: envStr("CONSENT_VERSION", "2026-10-v1"),

  // Links
  links: {
    privacyPolicyUrl: envStr(
      "PRIVACY_POLICY_URL",
      "https://www.precisioncuso.com/privacy"
    ),
    bookingUrl: envStr("BOOKING_URL", "https://www.precisioncuso.com/book-a-demo"),
    playBaseUrl: envStr("PLAY_BASE_URL", "https://quiz.precisioncuso.com"),
  },

  // Quiz mechanics
  quiz: {
    questionsPerAttempt: envInt("QUESTIONS_PER_ATTEMPT", 5),
    knowledgeCount: envInt("QUIZ_KNOWLEDGE_COUNT", 3),
    scenarioCount: envInt("QUIZ_SCENARIO_COUNT", 2),
    questionTimeLimitMs: envInt("QUESTION_TIME_LIMIT_MS", 20000),
    maxAttempts: envInt("MAX_ATTEMPTS", 2),
    maxScorePerQuestion: 1000,
    basePoints: 500,
    speedBonusPoints: 500,
    resultIdleTimeoutMs: envInt("KIOSK_IDLE_TIMEOUT_MS", 45000),
    feedbackDwellMs: envInt("FEEDBACK_DWELL_MS", 2500),
    clientTimingToleranceMs: envInt("CLIENT_TIMING_TOLERANCE_MS", 3000),
  },

  // Display screen
  display: {
    boardRotateMs: envInt("DISPLAY_ROTATE_MS", 10000),
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
      feedbackDwellMs: config.quiz.feedbackDwellMs,
    },
    display: config.display,
    nicknameBlocklist: config.nicknameBlocklist,
  };
}

export type PublicConfig = ReturnType<typeof getPublicConfig>;
