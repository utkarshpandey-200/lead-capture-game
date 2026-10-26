/**
 * Captures screenshots of the key screens (registration, question,
 * feedback, result, display, admin) at 390x844 (mobile) and 1920x1080
 * (desktop) for visual review.
 *
 * Requires the server to already be running (npm run dev:server, or
 * node dist/server/server/index.js after npm run build) with
 * ALLOW_DRAFT_QUESTIONS=true and ADMIN_PASSWORD set, against a reachable
 * BASE_URL. Pass ADMIN_PASSWORD matching the running server's env.
 *
 * Run with: BASE_URL=http://localhost:8080 ADMIN_PASSWORD=... npm run screenshots
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/shared/config.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "dev-admin-pass";
const OUT_DIR = process.env.SCREENSHOT_DIR ?? "./screenshots";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1920, height: 1080 };

async function playThroughToResult(page: Page, email: string, prefix: string) {
  await page.goto(`${BASE_URL}/play`);
  await page.waitForSelector(".screen-title");
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-1-intro.png`) });

  await page.click("text=Play");
  await page.waitForSelector("#firstName");
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-2-register.png`) });

  await page.fill("#firstName", "Jane");
  await page.fill("#lastName", "Doe");
  await page.fill("#organization", "Acme Credit Union");
  await page.fill("#email", email);
  await page.check("#consent");
  await page.click('button[type="submit"]');

  await page.waitForSelector(".question-prompt", { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-3-quiz.png`) });

  await page.click(".option-btn");
  await page.waitForSelector(".feedback-panel", { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-4-feedback.png`) });

  // The first question is already answered above; this handles the rest.
  for (let i = 0; i < config.quiz.questionsPerAttempt - 1; i++) {
    await page.click("text=Next");
    await page.waitForSelector(".question-prompt", { timeout: 10000 });
    await page.click(".option-btn");
    await page.waitForSelector(".feedback-panel", { timeout: 10000 });
  }
  await page.click("text=Next");
  await page.waitForSelector(".result-score", { timeout: 10000 });
  await page.waitForTimeout(1200); // let the count-up animation settle
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-5-result.png`) });
}

async function shootDisplay(page: Page, prefix: string) {
  await page.goto(`${BASE_URL}/display?board=overall`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-6-display.png`) });
}

async function shootAdmin(page: Page, prefix: string) {
  await page.goto(`${BASE_URL}/admin`);
  await page.waitForSelector("#admin-password", { timeout: 10000 });
  await page.fill("#admin-password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForSelector(".admin-table, .field-error", { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, `${prefix}-7-admin.png`) });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const stamp = Date.now();

  const mobilePage = await browser.newPage({ viewport: MOBILE });
  await playThroughToResult(mobilePage, `screenshot-mobile-${stamp}@example.com`, "mobile");
  await shootDisplay(mobilePage, "mobile");
  await shootAdmin(mobilePage, "mobile");

  const desktopPage = await browser.newPage({ viewport: DESKTOP });
  await playThroughToResult(desktopPage, `screenshot-desktop-${stamp}@example.com`, "desktop");
  await shootDisplay(desktopPage, "desktop");
  await shootAdmin(desktopPage, "desktop");

  await browser.close();
  console.log(`Screenshots written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
