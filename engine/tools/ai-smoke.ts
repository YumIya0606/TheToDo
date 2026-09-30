import path from "node:path";

// The app resolves its folder from CLASSRADAR_DATA_DIR, not from a file path.
const DATA_DIR =
  process.env.CLASSRADAR_DATA_DIR ??
  path.join(process.env.APPDATA ?? "", "ClassRadar", "data");
process.env.CLASSRADAR_DATA_DIR = DATA_DIR;
const dbPath = path.join(DATA_DIR, "classradar.db");
const LIMIT = Number(process.env.LIMIT ?? 12);

/**
 * Do the setup through the app's own connection. A second DatabaseSync handle on
 * the same WAL file does not reliably observe the first one's writes, which
 * makes it useless for preparing work that the app is about to read back.
 */
const { db } = await import("../server/src/db/index.ts");
console.log(`database: ${dbPath}`);

const victims = db
  .prepare(
    `SELECT id FROM messages
     WHERE LENGTH(text) > 60
       AND id NOT IN (SELECT message_id FROM analysis WHERE provider NOT IN ('rules'))
     ORDER BY date DESC LIMIT ?`,
  )
  .all(LIMIT) as any[];
for (const v of victims) db.prepare("DELETE FROM analysis WHERE message_id = ?").run(v.id);
db.prepare("DELETE FROM events").run();
db.prepare("DELETE FROM event_sources").run();
db.prepare("DELETE FROM tasks").run();
console.log(`cleared ${victims.length} messages for a real AI pass\n`);

const t0 = Date.now();
const { runAnalysisQueue } = await import("../server/src/pipeline/sync.ts");
const { listEvents } = await import("../server/src/pipeline/project.ts");
const { todayColombo } = await import("../server/src/ai/engine.ts");
const q = await runAnalysisQueue(undefined, LIMIT + 4);
console.log(
  `processed=${q.processed} usedAi=${q.usedAi} failed=${q.failed} rateLimited=${q.rateLimited} remaining=${q.remaining} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
if (q.lastError) console.log(`lastError: ${q.lastError}`);
if (q.advice) console.log(`advice: ${q.advice.headline} — ${q.advice.action}`);

console.log("\n--- what the model understood ---");
for (const r of db
  .prepare(
    `SELECT c.username, a.kind, a.class_type, a.headline, a.detail, a.action, a.event_date, a.event_time, a.status_change, a.is_full_syllabus, a.confidence, a.model, m.text
     FROM analysis a JOIN messages m ON m.id=a.message_id JOIN channels c ON c.id=m.channel_id
     WHERE a.provider NOT IN ('rules')
     ORDER BY m.date DESC`,
  )
  .all() as any[]) {
  console.log(`\n[${r.kind}${r.class_type ? "/" + r.class_type : ""}] @${r.username} ${r.model}`);
  console.log(`  SIN : ${String(r.text).replace(/\s+/g, " ").slice(0, 145)}`);
  console.log(`  EN  : ${r.headline}`);
  if (r.detail) console.log(`  DET : ${String(r.detail).slice(0, 240)}`);
  if (r.action) console.log(`  ACT : ${r.action}`);
  console.log(`  WHEN: ${r.event_date ?? "-"} ${r.event_time ?? "-"}  status=${r.status_change ?? "-"} fullSyllabus=${r.is_full_syllabus} conf=${r.confidence}`);
}

const evs = listEvents({ limit: 900 });
const today = todayColombo();
const upcoming = evs.filter((e) => e.event_date && e.event_date >= today);
console.log(`\n--- events rebuilt: ${evs.length} total, ${upcoming.length} today or later ---`);
for (const e of upcoming.slice(0, 12)) {
  console.log(
    `  ${e.event_date} ${(e.event_time ?? "").padEnd(5)} [${e.subject}/${e.class_type}/${e.status}]${e.is_full_syllabus ? " [FULL SYLLABUS]" : ""} ${e.title.slice(0, 56)}`,
  );
}
db.close();
