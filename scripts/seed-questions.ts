/**
 * Loads data/questions.seed.json into the database, upserting by question
 * id. The server already does this automatically on first boot (when the
 * questions table is empty), so this script is mainly useful for forcing a
 * re-import of the seed file's content later (e.g. after hand-editing it)
 * without restarting the server.
 *
 * WARNING: this overwrites every field, including `status`, for any
 * question id already in the seed file — if you've approved questions in
 * /admin and then re-run this script with the seed file still marked
 * "draft", those questions go back to draft. Prefer the admin UI's
 * per-question status toggle for day-to-day approval; use this script to
 * resync content, not to manage approval state.
 *
 * Run with: npm run seed:questions
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { loadQuestionsFromSeedFile } from "../src/server/db/questions.js";

const seedPath = fileURLToPath(new URL("../data/questions.seed.json", import.meta.url));

const result = loadQuestionsFromSeedFile(seedPath);
console.log(`Loaded ${result.count} questions from ${seedPath}`);
console.log(`Note: this reset the status field of any matching question id to whatever the seed file has.`);
