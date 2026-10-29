# The AI-in-Lending Speed Quiz

A Kahoot-style, single-player speed quiz built for the Precision CUSO booth at ACU Lending Council 2026. Visitors register, answer 3 timed multiple-choice questions on the credit union movement, and see their rank. A second screen at the booth shows the live top 5, filterable by day.

## Stack

- **TypeScript** end to end.
- **Server:** [Fastify](https://fastify.dev) (Node 20+), with `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/static`.
- **Database:** SQLite via `better-sqlite3`, on a persistent disk. One booth, one event, a few hundred concurrent players at most — SQLite with WAL mode comfortably handles this load with zero operational overhead (no separate database service to provision, back up, or pay for). If you outgrow a single booth/event or need multi-region writes, Postgres would be the better choice; the data-access layer is small and isolated in `src/server/db/` if you ever need to swap it.
- **Client:** React + Vite, served as static files by the same Fastify server (one deployable service, one port).
- **Live updates:** polling with ETag/`If-None-Match` conditional requests, not WebSockets — simpler to deploy and resilient to the convention center's flaky wifi (a dropped poll just retries; there's no persistent connection to reconnect).
- **Tests:** Vitest (unit + integration via Fastify's `.inject()`), Playwright for visual QA screenshots.

## Project layout

```
src/
  shared/     # config, types, and pure logic (scoring, ranking, timing) shared by client + server
  server/     # Fastify app, routes, db access, business logic
  client/     # React app (Vite root), one route each for /play, /display, /admin
data/
  questions.seed.json   # the question bank, loaded into the DB on first boot
scripts/      # seed-demo, seed-questions, wipe-test-data, purge-all-data, backup-db, screenshots
tests/
  unit/         # scoring, ranking, timing, nickname-filter tests
  integration/  # full register -> play -> result -> leaderboard flow, admin endpoints
```

## Running locally

Requires Node 20+.

```bash
npm install
cp .env.example .env
```

Edit `.env` — at minimum set `ADMIN_PASSWORD` and `SESSION_SECRET`, and set `ALLOW_DRAFT_QUESTIONS=true` (the shipped question bank is all `status: "draft"` until you fact-check it — see **Questions** below).

```bash
npm run dev:client   # Vite dev server on :5173, proxies /api to :8080
npm run dev:server   # Fastify on :8080 (separate terminal)
```

Open `http://localhost:5173/play`. The server auto-creates the SQLite file at `DATABASE_PATH` (default `./data/quiz.sqlite`) and seeds questions from `data/questions.seed.json` the first time it boots against an empty database.

For a single-process local check that matches production (one server serving the built client):

```bash
npm run build
npm start            # serves the built client + API on :8080
```

### Tests

```bash
npm test             # unit + integration, ~70 tests
```

### Demo data

```bash
npm run seed:demo    # ~150 fake players with varied scores, flagged as test data
```

Use this to check `/display` and ranking behavior with a realistic amount of data. Demo players behave like real plays (they appear on the leaderboard and display) but are flagged `is_test`, excluded from the CSV lead export, and removable in one action from `/admin` → Players → **Wipe test data** (or `npm run wipe:test-data`).

### Screenshots

```bash
BASE_URL=http://localhost:8080 ADMIN_PASSWORD=... npm run screenshots
```

Walks the full player flow and captures the display/admin screens at 390×844 and 1920×1080 into `./screenshots` (requires a running server with `ALLOW_DRAFT_QUESTIONS=true`, and `npx playwright install chromium` once beforehand).

## Configuration

All branding, copy, timing and limits live in **`src/shared/config.ts`**, overridable by environment variable — see `.env.example` for the full list with defaults and comments. Nothing is hard-coded in components; the client fetches the public subset from `GET /api/config` on load, so you can change copy, colors, or timing without a rebuild (just restart the server with new env vars).

Key variables to review before the event:

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Required to reach `/admin`. |
| `SESSION_SECRET` | Signs player session cookies. Set to a long random string in production. |
| `ALLOW_DRAFT_QUESTIONS` | Must be `false` in production until questions are approved (see below). |
| `MAX_ATTEMPTS` | Attempts per player before practice-only mode (default 2). |
| `QUESTION_TIME_LIMIT_MS` | Per-question timer (default 20000). |
| `EVENT_TIMEZONE` | Day boundary for the Daily board (default `America/Los_Angeles`). |
| `BOOKING_URL`, `PRIVACY_POLICY_URL`, `PLAY_BASE_URL` | **Replace these placeholders before the event.** |
| `BRAND_*`, `QUIZ_TITLE`, `INTRO_*` | Branding and copy. |

### Branding

Colors, logo, and typeface default to Precision CUSO's actual brand kit, pulled from precisioncuso.org's live site:

- **Logo:** `src/client/public/brand/precision-cuso-logo.webp` (full color lockup — mark, "precisioncuso" wordmark, and the "Own. Control. Scale." tagline), plus a standalone mark-only `precision-cuso-icon.png` and the site's real favicon/apple-touch-icon. On the dark `/display` screen the logo sits in a small white chip so its real colors stay intact against the dark background, rather than being recolored.
- **Colors:** `BRAND_PRIMARY_COLOR=#072559` (navy), `BRAND_SECONDARY_COLOR=#F5B731` (gold), `BRAND_ACCENT_COLOR=#0F8B4C` (success green) — the same tokens the site uses for its primary buttons, accent, and success states. The neutral background/text/border palette in `src/client/src/styles.css` was also tuned to match the site's tokens (`--ink`, `--muted`, `--line`, etc.).
- **Typeface:** DM Sans Variable, self-hosted at `src/client/public/fonts/dm-sans-variable.woff2` (not loaded from Google Fonts) so the booth app never depends on an external font CDN over convention wifi.

If the brand kit ever changes, swap the files in `src/client/public/brand/` and `public/fonts/`, update `BRAND_LOGO_PATH` and the three `BRAND_*_COLOR` vars, and rebuild the client (changes to `public/` need a rebuild, not just a server restart).

## Questions

`data/questions.seed.json` ships with a bank of 5 `knowledge` questions plus 1 `bonus` question, **all marked `status: "draft"`** — they need a fact-check/approval pass before the event. Only `status: "approved"` questions are served when `ALLOW_DRAFT_QUESTIONS=false` (the production default). Each attempt serves `QUIZ_KNOWLEDGE_COUNT` (default 3) of the knowledge questions — a random subset, in a random order, preferring questions that player hasn't seen on a prior attempt — followed by `QUIZ_BONUS_COUNT` (default 1) bonus question(s). The bonus question is never shuffled in with the rest: it's always the fixed last question of the attempt ("🎁 Bonus Question" in the UI), so with one approved bonus question in the bank every player sees the same one. The knowledge bank can grow past 5 any time (via `/admin` → Questions or `npm run seed:questions`) without touching `QUIZ_KNOWLEDGE_COUNT`; attempts just keep drawing a random 3.

To approve questions: log into `/admin` → Questions, review each one, and toggle its status. To bulk-import a revised question set, paste or upload JSON in the same tab (same shape as the seed file; existing ids are updated in place, new ids are added).

## Admin

`/admin`, password-protected via `ADMIN_PASSWORD` (secure, signed session cookie; login attempts are rate-limited).

- **Players:** search/sort, hide from leaderboards, mark/unmark as test data, delete a player and all their data, export the lead-list CSV, wipe all test data (with confirmation).
- **Questions:** approve/revert status, JSON import.

The CSV export (`GET /api/admin/export.csv`, or the "Export CSV" button) includes name, organization, email, consent flag and timestamp, best score, overall rank, today's rank, attempts, and first/last played — excluding anyone flagged as test data. Run it at the end of each day for the lead list.

### Every entry is unique

Registration never looks up or resumes an existing player — even registering with identical details creates a separate player record each time. There's no "welcome back," no cross-device resume, and the two-attempt cap is per player record, not per person, so it only holds within one browser session (clearing cookies, switching devices, or just registering again all reset it). The public leaderboard and `/display` follow the same rule: every player record gets its own row, even if two entries end up with an identical displayed name and organization. The register screen no longer collects email, so it's blank on every player and the CSV lead export carries name/organization/consent only — nothing to contact leads with beyond that.

## Backups

```bash
npm run backup:db
```

Uses SQLite's online backup API (safe while the server is running) and writes a timestamped copy to `data/backups/`. Run this on a schedule — e.g. a daily cron job or your host's scheduled-job feature pointed at this command — or manually at the end of each event day alongside the CSV export. On hosts with scheduled jobs (Render Cron Jobs, Railway Cron, Fly Machines on a schedule), point the job at `npm run backup:db` with the same environment and persistent disk as the main service.

## Security & privacy

- HTTPS only in production (terminate TLS at your host/load balancer; cookies are marked `secure` when `NODE_ENV=production`).
- Every endpoint validates input (Zod) and uses parameterized queries (better-sqlite3 prepared statements).
- Correct answers are never sent to the client before an answer is submitted.
- Timing is reconciled server-side (`src/shared/timing.ts`) so a slow network is never penalized, but a client can't claim an impossibly fast answer.
- Rate limiting: a global cap plus stricter limits on `/api/register` and the admin login route; registration also has a honeypot field.
- CORS is closed by default (same-origin deployment); only set `CORS_ORIGIN` if you deploy the client separately from the API.
- Application logs never include full email addresses or request bodies (Fastify's default logger logs method/URL/status only).
- **Data retention:** after the post-event follow-up period, run `npm run purge:all-data` to permanently delete every player record and attempt (it requires typing a confirmation phrase, or pass `--yes` non-interactively). This is separate from "wipe test data," which only removes rehearsal/demo players and leaves real leads in place.

## Deploying

One service, one Dockerfile, a persistent disk for `data/`, HTTPS, and a custom subdomain. Any of Render, Railway, or Fly.io work well for this shape of app.

### Render

1. New **Web Service** from this repo, using the included `Dockerfile` (Render builds it automatically).
2. Add a **persistent disk**, mounted at `/app/data` (1 GB is overkill for this workload).
3. Set environment variables from `.env.example` (at least `ADMIN_PASSWORD`, `SESSION_SECRET`, `ALLOW_DRAFT_QUESTIONS=false`, the `BOOKING_URL`/`PRIVACY_POLICY_URL`/`PLAY_BASE_URL` placeholders, `NODE_ENV=production`).
4. Render provisions HTTPS automatically; add your custom subdomain (e.g. `quiz.precisioncuso.com`) under Settings → Custom Domains and point a CNAME at it.

### Railway

1. New project → Deploy from repo; Railway detects the `Dockerfile`.
2. Add a **Volume**, mounted at `/app/data`.
3. Set the same environment variables as above.
4. Railway provisions a `*.up.railway.app` HTTPS domain automatically; add a custom domain under Settings → Networking.

### Fly.io

1. `fly launch` (it will find the `Dockerfile`; decline the Postgres/Redis prompts — not needed).
2. `fly volumes create quiz_data --size 1` and mount it at `/app/data` in `fly.toml`:
   ```toml
   [mounts]
     source = "quiz_data"
     destination = "/app/data"
   ```
3. `fly secrets set ADMIN_PASSWORD=... SESSION_SECRET=... ALLOW_DRAFT_QUESTIONS=false ...`
4. Fly provisions HTTPS automatically; `fly certs add quiz.precisioncuso.com` for a custom subdomain.

### Docker, generically

```bash
docker build -t speed-quiz .
docker run -p 8080:8080 \
  -v "$(pwd)/data:/app/data" \
  --env-file .env \
  speed-quiz
```

Whatever host you use: **the `data` directory must be on a persistent volume**, or the lead list and leaderboard are lost on every redeploy/restart.

## Definition of done checklist

- [x] A new visitor can register, finish a 3-question round in about a minute, and see their daily and overall rank.
- [x] `/display` shows the live top 5, filterable by day, and updates within a few seconds of a new score (polling at `DISPLAY_POLL_INTERVAL_MS`, default 3s).
- [x] Correct answers are never exposed before answering; timing is server-reconciled; the lead CSV exports correctly.
- [x] Tests pass (`npm test`) and the app runs from a clean clone with the steps above.
