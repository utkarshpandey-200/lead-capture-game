/**
 * Backs up the live SQLite database to data/backups/ using better-sqlite3's
 * online backup API (safe to run while the server is up). Run manually at
 * the end of each day, or on a schedule — see README "Backups" for how to
 * wire this into cron / your host's scheduled jobs.
 *
 * Run with: npm run backup:db
 */
import "dotenv/config";
import path from "node:path";
import { backupDatabase } from "../src/server/db/index.js";
import { config } from "../src/shared/config.js";

async function main() {
  if (config.server.databasePath === ":memory:") {
    console.log("DATABASE_PATH is :memory: — nothing to back up.");
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(path.dirname(config.server.databasePath), "backups");
  const dest = path.join(dir, `quiz-${stamp}.sqlite`);
  await backupDatabase(dest);
  console.log(`Backed up database to ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
