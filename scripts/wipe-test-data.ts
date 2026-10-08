/**
 * CLI equivalent of the /admin "Wipe test data" button: deletes every
 * player flagged is_test (and all of their attempts/answers), leaving
 * real players untouched. Useful for clearing rehearsal or seed:demo data
 * from a terminal/CI step without going through the UI.
 *
 * Run with: npm run wipe:test-data -- --yes
 * (omit --yes to be asked for confirmation first)
 */
import "dotenv/config";
import readline from "node:readline/promises";
import { wipeTestData } from "../src/server/db/players.js";
import { db } from "../src/server/db/index.js";

async function confirm(message: string): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${message} Type "yes" to continue: `);
  rl.close();
  return answer.trim().toLowerCase() === "yes";
}

async function main() {
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM players WHERE is_test = 1`).get() as { n: number }).n;
  if (count === 0) {
    console.log("No test-flagged players found. Nothing to do.");
    return;
  }

  const ok = await confirm(`This will permanently delete ${count} test-flagged player(s) and all their attempts.`);
  if (!ok) {
    console.log("Cancelled.");
    return;
  }

  const result = wipeTestData();
  console.log(`Deleted ${result.playersDeleted} test player(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
