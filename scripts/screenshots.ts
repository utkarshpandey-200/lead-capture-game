/**
 * Captures screenshots of the key screens for visual review.
 * Requires the server to already be running (npm run dev:server or
 * node dist/server/server/index.js) with ALLOW_DRAFT_QUESTIONS=true
 * against a reachable BASE_URL.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const OUT_DIR = process.env.SCREENSHOT_DIR ?? "./screenshots";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1920, height: 1080 };

async function playThroughToResult(page: import("playwright").Page, email: string) {
  await page.goto(`${BASE_URL}/play`);
  await page.waitForSelector(".screen-title");
  await page.screenshot({ path: path.join(OUT_DIR, "mobile-1-intro.png") });

  await page.click("text=Play");
  await page.waitForSelector("#firstName");
  await page.screenshot({ path: path.join(OUT_DIR, "mobile-2-register.png") });

  await page.fill("#firstName", "Jane");
  await page.fill("#lastName", "Doe");
  await page.fill("#organization", "Acme Credit Union");
  await page.fill("#email", email);
  await page.check("#consent");
  await page.click('button[type="submit"]');

  await page.waitForSelector(".question-prompt", { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, "mobile-3-quiz.png") });

  await page.click(".option-btn");
  await page.waitForSelector(".feedback-panel", { timeout: 10000 });
  await page.screenshot({ path: path.join(OUT_DIR, "mobile-4-feedback.png") });

  for (let i = 0; i < 4; i++) {
    await page.click("text=Next");
    await page.waitForSelector(".question-prompt", { timeout: 10000 });
    await page.click(".option-btn");
    await page.waitForSelector(".feedback-panel", { timeout: 10000 });
  }
  await page.click("text=Next");
  await page.waitForSelector(".result-score", { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, "mobile-5-result.png") });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  const mobilePage = await browser.newPage({ viewport: MOBILE });
  await playThroughToResult(mobilePage, `screenshot-${Date.now()}@example.com`);

  const desktopPage = await browser.newPage({ viewport: DESKTOP });
  await desktopPage.goto(`${BASE_URL}/display`);
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({ path: path.join(OUT_DIR, "desktop-1-display.png") });

  await desktopPage.goto(`${BASE_URL}/admin`);
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: path.join(OUT_DIR, "desktop-2-admin.png") });

  await browser.close();
  console.log(`Screenshots written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
