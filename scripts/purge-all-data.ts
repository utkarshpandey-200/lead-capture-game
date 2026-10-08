/**
 * Permanently deletes ALL personal data collected by the quiz — every
 * player, regardless of test/hidden flags, and all of their attempts and
 * answers. Questions are left untouched.
 *
 * This is the documented command for satisfying a "delete all personal
 * data after the follow-up period" obligation: run this once the lead
 * follow-up window after the event has closed (see README "Data
 * retention"). It is intentionally separate from the admin "wipe test
 * data" action, which only removes rehearsal/demo data and leaves real
 * leads in place.
 *
 * This is irreversible. Back up the database first if you need to keep
 * a record (see README "Backups").
 *
 * Run with: npm run purge:all-data -- --yes
 * (omit --yes to be asked to type a confirmation phrase first)
 */
import "dotenv/config";
import readline from "node:readline/promises";
import { db } from "../src/server/db/index.js";

const CONFIRMATION_PHRASE = "DELETE ALL PLAYER DATA";

async function confirm(playerCount: number): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`This will permanently delete all ${playerCount} player(s), including real leads, and cannot be undone.`);
  const answer = await rl.question(`Type "${CONFIRMATION_PHRASE}" to continue: `);
  rl.close();
  return answer.trim() === CONFIRMATION_PHRASE;
}

async function main() {
  const playerCount = (db.prepare(`SELECT COUNT(*) AS n FROM players`).get() as { n: number }).n;
  if (playerCount === 0) {
    console.log("No players in the database. Nothing to do.");
    return;
  }

  const ok = await confirm(playerCount);
  if (!ok) {
    console.log("Cancelled — confirmation did not match.");
    return;
  }

  const purge = db.transaction(() => {
    db.exec(`DELETE FROM attempt_questions`);
    db.exec(`DELETE FROM attempts`);
    db.exec(`DELETE FROM players`);
  });
  purge();

  console.log(`Deleted ${playerCount} player(s) and all associated attempts/answers. Questions were left untouched.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
