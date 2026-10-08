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
    },
  },
});
