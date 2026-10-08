import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../shared/config.js";
import { SCHEMA_SQL } from "./schema.js";

const dbPath = config.server.databasePath;
const dir = path.dirname(dbPath);
if (dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA_SQL);

export function backupDatabase(destPath: string): Promise<void> {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  return db.backup(destPath).then(() => undefined);
}
