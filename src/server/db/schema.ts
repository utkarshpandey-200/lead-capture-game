export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  organization TEXT NOT NULL,
  consent_given INTEGER NOT NULL,
  consent_version TEXT NOT NULL,
  consent_timestamp TEXT NOT NULL,
  display_mode TEXT NOT NULL CHECK (display_mode IN ('first_org', 'full_name', 'nickname')),
  display_value TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_email ON players (email);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('knowledge', 'scenario')),
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_status_type ON questions (status, type);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  total_score INTEGER NOT NULL DEFAULT 0,
  total_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  event_day TEXT NOT NULL,
  is_practice INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'finished'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_player ON attempts (player_id);
CREATE INDEX IF NOT EXISTS idx_attempts_board ON attempts (status, is_practice, event_day);

CREATE TABLE IF NOT EXISTS attempt_questions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts (id),
  position INTEGER NOT NULL,
  question_id TEXT NOT NULL REFERENCES questions (id),
  shuffled_options TEXT NOT NULL,
  served_at TEXT,
  answered_at TEXT,
  chosen_option INTEGER,
  correct INTEGER,
  elapsed_ms INTEGER,
  points INTEGER
);

CREATE INDEX IF NOT EXISTS idx_attempt_questions_attempt ON attempt_questions (attempt_id, position);
CREATE INDEX IF NOT EXISTS idx_attempt_questions_question ON attempt_questions (question_id);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
`;
