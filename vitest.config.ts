import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    env: {
      DATABASE_PATH: ":memory:",
      ALLOW_DRAFT_QUESTIONS: "true",
      ADMIN_PASSWORD: "test-admin-password",
      SESSION_SECRET: "test-session-secret",
      EVENT_TIMEZONE: "America/Los_Angeles",
      CORS_ORIGIN: "",
      NODE_ENV: "test",
      // Production-sized rate limits exist to stop booth abuse, not to
      // constrain how many requests a test file can make. A single test
      // file's suite can easily exceed the real register/global limits
      // well within their 1-minute window, so raise them generously here.
      RATE_LIMIT_GLOBAL_MAX: "100000",
      RATE_LIMIT_REGISTER_MAX: "10000",
      RATE_LIMIT_ANSWER_MAX: "100000",
      RATE_LIMIT_ADMIN_LOGIN_MAX: "10000",
    },
  },
});
