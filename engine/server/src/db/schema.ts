// TheToDo database schema.
//
// Kept as a string in TypeScript rather than a .sql file on disk so that the
// whole server can be bundled into one CommonJS file for the desktop app, where
// there is no loose file to read at runtime.

export const SCHEMA_SQL = `
-- messages: raw + normalized Telegram messages
-- analysis:  AI extraction (one row per message, re-runnable)
-- events:   merged class events across channels (postponements resolve into the same event)
-- links:    extracted URLs (zoom / youtube / pdf / drive / web) with owning event
-- tasks:    actionable items (papers to do, videos to watch, links to open)
-- settings: key/value app config incl. secrets

CREATE TABLE IF NOT EXISTS channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL DEFAULT '',
  subject       TEXT NOT NULL DEFAULT 'other',   -- combined_maths | physics | other
  teacher       TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'theory',  -- theory|revision|paper|booster
  accent        TEXT NOT NULL DEFAULT '#3b82f6',
  enabled       INTEGER NOT NULL DEFAULT 1,
  last_sync_at  INTEGER,
  last_scanned_id INTEGER NOT NULL DEFAULT 0,
  member_count  INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id    INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  msg_id        INTEGER NOT NULL,
  date          INTEGER NOT NULL,               -- unix seconds
  edit_date     INTEGER,
  text          TEXT NOT NULL DEFAULT '',
  raw_text      TEXT NOT NULL DEFAULT '',
  has_media     INTEGER NOT NULL DEFAULT 0,
  media_kind    TEXT,                            -- photo|video|document|sticker|voice
  media_name    TEXT,
  media_mime    TEXT,
  media_size    INTEGER,
  media_ref     TEXT,                            -- opaque ref for on-demand download
  is_forwarded  INTEGER NOT NULL DEFAULT 0,
  forward_from  TEXT,
  views         INTEGER,
  has_reply     INTEGER NOT NULL DEFAULT 0,
  reply_to_id   INTEGER,
  grouped_id    INTEGER,
  source        TEXT NOT NULL DEFAULT 'mtproto',  -- mtproto | webpreview
  is_important  INTEGER NOT NULL DEFAULT 0,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  UNIQUE(channel_id, msg_id, source)
);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_date ON messages(channel_id, date DESC);

CREATE TABLE IF NOT EXISTS analysis (
  message_id    INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  kind          TEXT NOT NULL DEFAULT 'other',   -- see shared/types.ts MessageKind
  class_type    TEXT,                            -- theory|extra|revision|paper|booster
  subject       TEXT,
  headline      TEXT NOT NULL DEFAULT '',
  detail        TEXT NOT NULL DEFAULT '',        -- English explanation of what the msg says
  action        TEXT,                            -- what the student must DO
  urgency       TEXT NOT NULL DEFAULT 'normal',  -- critical|high|normal|low
  status_change TEXT,                            -- scheduled|postponed|cancelled|rescheduled|started|completed
  event_date    TEXT,                            -- YYYY-MM-DD
  event_time    TEXT,                            -- HH:MM (24h, Colombo)
  event_end_time TEXT,
  is_full_syllabus INTEGER NOT NULL DEFAULT 0,
  -- Physics theory posts a daily "which questions from which tute, how many".
  -- That is booster-tracker data, not a class event, so it lives here rather
  -- than being forced into the schedule.
  tute_name      TEXT,
  question_count INTEGER,
  question_numbers TEXT,                        -- JSON array; the set is not contiguous
  booster_kind   TEXT,                            -- speed | theory | null
  booster_episode INTEGER,                        -- the episode number named in the post
  confidence    REAL NOT NULL DEFAULT 0,
  raw_json      TEXT,
  analyzed_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_kind ON analysis(kind);
CREATE INDEX IF NOT EXISTS idx_analysis_event_date ON analysis(event_date);

CREATE TABLE IF NOT EXISTS events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  subject        TEXT NOT NULL,
  class_type     TEXT NOT NULL,                  -- theory|extra|revision|paper|booster|seminar
  title          TEXT NOT NULL,
  event_date     TEXT,                           -- YYYY-MM-DD (null = unscheduled announcement)
  event_time     TEXT,                           -- HH:MM
  event_end_time TEXT,
  status         TEXT NOT NULL DEFAULT 'scheduled',
  is_full_syllabus INTEGER NOT NULL DEFAULT 0,
  is_exam_style  INTEGER NOT NULL DEFAULT 0,
  note           TEXT NOT NULL DEFAULT '',
  action         TEXT,
  urgency        TEXT NOT NULL DEFAULT 'normal',
  confidence     REAL NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date, event_time);
CREATE INDEX IF NOT EXISTS idx_events_subject ON events(subject, event_date);

CREATE TABLE IF NOT EXISTS event_sources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  UNIQUE(event_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sources_message ON event_sources(message_id);

CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_id   INTEGER REFERENCES events(id) ON DELETE SET NULL,
  url        TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'web',        -- zoom|youtube|pdf|drive|form|website|tg|web
  label      TEXT NOT NULL DEFAULT '',
  host       TEXT NOT NULL DEFAULT '',
  UNIQUE(message_id, url)
);
CREATE INDEX IF NOT EXISTS idx_links_event ON links(event_id);
CREATE INDEX IF NOT EXISTS idx_links_kind ON links(kind);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  event_id   INTEGER REFERENCES events(id) ON DELETE CASCADE,
  subject    TEXT NOT NULL DEFAULT 'other',
  kind       TEXT NOT NULL,                      -- paper|test|video|attend|download|read|form
  title      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  due_date   TEXT,
  due_time   TEXT,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(done, due_date);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id  INTEGER,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  ok          INTEGER NOT NULL DEFAULT 0,
  fetched     INTEGER NOT NULL DEFAULT 0,
  inserted    INTEGER NOT NULL DEFAULT 0,
  mode        TEXT,
  error       TEXT
);

-- User-defined OpenAI-compatible endpoints (OpenRouter clones, local servers,
-- universities, anything that speaks /v1/chat/completions).
CREATE TABLE IF NOT EXISTS custom_providers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  base_url    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'openai_compat',
  api_key     TEXT,
  models_url  TEXT,
  model       TEXT NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- A pool of keys per provider. Free tiers cap requests per key, so several keys
-- for one provider multiply throughput; health is tracked so TheToDo can
-- route around whichever one is currently throttled or rejected.
CREATE TABLE IF NOT EXISTS api_keys (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  provider        TEXT NOT NULL,               -- gemini | openrouter | kilo | custom:<id>
  label           TEXT NOT NULL DEFAULT '',
  key_value       TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'unknown', -- active | rate_limited | invalid | unknown
  last_error      TEXT,
  disabled_until  INTEGER NOT NULL DEFAULT 0, -- epoch ms; skip until then
  ok_count        INTEGER NOT NULL DEFAULT 0,
  fail_count      INTEGER NOT NULL DEFAULT 0,
  used_count      INTEGER NOT NULL DEFAULT 0,
  last_used_at    INTEGER NOT NULL DEFAULT 0,
  last_ok_at      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_pick ON api_keys(provider, enabled, disabled_until);

-- Second opinion on an extraction.
--
-- A model that invents a plausible class time is the failure that actually
-- hurts, and it is invisible in a single reading. Running a second, different
-- model and comparing the structured result catches it: agreement raises
-- confidence, disagreement is recorded so the student can check that one
-- message instead of trusting or re-running the whole backlog.
CREATE TABLE IF NOT EXISTS crosscheck (
  message_id   INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  primary_provider TEXT NOT NULL,
  primary_model    TEXT NOT NULL,
  primary_json     TEXT NOT NULL,
  verifier_provider TEXT NOT NULL,
  verifier_model    TEXT NOT NULL,
  verifier_json     TEXT NOT NULL,
  agreed         INTEGER NOT NULL DEFAULT 0,
  disagreements    TEXT NOT NULL DEFAULT '',   -- "event_date,event_time"
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crosscheck_agreed ON crosscheck(agreed);

-- Text pulled out of an attachment on this machine.
--
-- Papers arrive as PDFs, often scans. Sending the file to a model costs a lot of
-- the request budget and tells us nothing extra, so the text is extracted once
-- here and only a short excerpt is ever placed in a prompt. Images are never
-- sent at all.
CREATE TABLE IF NOT EXISTS attachment_text (
  message_id   INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'pdf',   -- pdf | text | image
  chars        INTEGER NOT NULL DEFAULT 0,
  excerpt      TEXT NOT NULL DEFAULT '',
  pages        INTEGER,
  extracted_at INTEGER NOT NULL
);
`;
