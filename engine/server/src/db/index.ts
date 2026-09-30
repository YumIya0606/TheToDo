import fs from "node:fs";
import path from "node:path";
import { Database } from "./driver.js";
import { DATA_DIR } from "../paths.js";
import { SCHEMA_SQL } from "./schema.js";
import type { Subject } from "../../../../shared/types.js";

/**
 * Where TheToDo keeps its database, session and downloads. Defaults to ./data when
 * run from source; the packaged desktop app points this at the per-user
 * application data folder so an upgrade never touches the user's history.
 */
export { DATA_DIR } from "../paths.js";
export const DB_PATH = path.join(DATA_DIR, "classradar.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(SCHEMA_SQL);

/**
 * `CREATE TABLE IF NOT EXISTS` creates a missing table but never adds a column
 * to one that already exists, so a new field would silently be absent on every
 * database written by an older build. Adding the column when it is missing
 * keeps upgrades working without shipping a migration tool.
 */
function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Added after the first release: the model reads this, and the projection used
// to read a column that was never persisted, so the flag never worked.
ensureColumn("analysis", "is_full_syllabus", "INTEGER NOT NULL DEFAULT 0");

// Physics theory names a tute, a set of question numbers and a booster episode in
// most of its daily posts. Nullable, so a post that mentions none is unaffected.
// The set replaced an earlier start/end pair: teachers pick questions from across
// the chapter, so a range described work the student was never given.
ensureColumn("analysis", "tute_name", "TEXT");
ensureColumn("analysis", "question_count", "INTEGER");
ensureColumn("analysis", "question_numbers", "TEXT");
ensureColumn("analysis", "booster_kind", "TEXT");
ensureColumn("analysis", "booster_episode", "INTEGER");

/* ------------------------------------------------------------------ settings */

export function getSetting<T = unknown>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  db.prepare(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}

/* ------------------------------------------------------------ channel seeds */

interface SeedChannel {
  username: string;
  title: string;
  subject: Subject;
  teacher: string;
  kind: string;
  accent: string;
  webPreview: boolean;
}

export const SEED_CHANNELS: SeedChannel[] = [
  {
    username: "RD27T",
    title: "2027 THEORY | COMBINED MATHS | RUWAN DARSHANA",
    subject: "combined_maths",
    teacher: "Ruwan Darshana",
    kind: "theory",
    accent: "#3b82f6",
    webPreview: true,
  },
  {
    username: "RD_27REVISION",
    title: "RD 2027 REVISION | COMBINED MATHS",
    subject: "combined_maths",
    teacher: "Ruwan Darshana",
    kind: "revision",
    accent: "#38bdf8",
    webPreview: true,
  },
  {
    username: "RD27PAPERONLINE",
    title: "RD 2027 PAPER ONLINE | COMBINED MATHS",
    subject: "combined_maths",
    teacher: "Ruwan Darshana",
    kind: "paper",
    accent: "#0ea5e9",
    webPreview: false,
  },
  {
    username: "DU27T",
    title: "2027 Physics Theory | Dr Darshana Ukuwela",
    subject: "physics",
    teacher: "Dr Darshana Ukuwela",
    kind: "theory",
    accent: "#6366f1",
    webPreview: false,
  },
  {
    username: "DU27PPR",
    title: "2027 Paper Class | Dr Darshana Ukuwela - Physics",
    subject: "physics",
    teacher: "Dr Darshana Ukuwela",
    kind: "paper",
    accent: "#818cf8",
    webPreview: true,
  },
  {
    username: "DU27BNRe",
    title: "2027 BRAND NEW REVISION | Dr DARSHANA UKUWELA - PHYSICS",
    subject: "physics",
    teacher: "Dr Darshana Ukuwela",
    kind: "revision",
    accent: "#a78bfa",
    webPreview: false,
  },
];

export function seedChannels(): void {
  const now = Date.now();
  const insert = db.prepare(`
    INSERT INTO channels (username, title, subject, teacher, kind, accent, created_at)
    VALUES (@username, @title, @subject, @teacher, @kind, @accent, @created_at)
    ON CONFLICT(username) DO UPDATE SET
      title = excluded.title,
      subject = excluded.subject,
      teacher = excluded.teacher,
      kind = excluded.kind
  `);
  const tx = db.transaction((rows: SeedChannel[]) => {
    for (const r of rows) {
      insert.run({
        username: r.username.replace(/^@/, ""),
        title: r.title,
        subject: r.subject,
        teacher: r.teacher,
        kind: r.kind,
        accent: r.accent,
        created_at: now,
      });
    }
  });
  tx(SEED_CHANNELS);
}

/** Whether the public web preview can be scraped for this channel (no login). */
export function webPreviewAvailable(username: string): boolean {
  const seed = SEED_CHANNELS.find(
    (c) => c.username.toLowerCase() === username.replace(/^@/, "").toLowerCase(),
  );
  return seed ? seed.webPreview : true;
}
