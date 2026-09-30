import { db } from "../server/src/db/index.ts";
import { runAnalysisQueue, syncAll } from "../server/src/pipeline/sync.ts";
import { listEvents } from "../server/src/pipeline/project.ts";
import { todayColombo, shiftDate } from "../server/src/ai/engine.ts";

const KEY = process.env.CLASSRADAR_KEY ?? "";
const PROVIDER = process.env.CLASSRADAR_PROVIDER ?? "openrouter";
const MODEL = process.env.CLASSRADAR_MODEL ?? "";
const WIPE = process.env.WIPE === "1";

if (KEY) {
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.apiKey',?)").run(JSON.stringify(KEY));
}
db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.provider',?)").run(JSON.stringify(PROVIDER));
if (MODEL) {
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.model',?)").run(JSON.stringify(MODEL));
} else {
  db.prepare("DELETE FROM settings WHERE key='ai.model'").run();
}

if (WIPE) {
  // Force a full re-read of every message with the current prompt + model.
  db.prepare("DELETE FROM analysis").run();
  db.prepare("DELETE FROM events").run();
  db.prepare("DELETE FROM links").run();
  db.prepare("DELETE FROM tasks").run();
  db.prepare("DELETE FROM event_sources").run();
  console.log("cleared analysis/events/links/tasks");
}

const LIMIT = Number(process.env.LIMIT ?? 40);
const t0 = Date.now();
const q = await runAnalysisQueue(undefined, LIMIT);
console.log(
  `\nqueue: processed=${q.processed} usedAi=${q.usedAi} failed=${q.failed} remaining=${q.remaining} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
if (q.lastError) console.log(`lastError: ${q.lastError}`);

const kinds = db.prepare("SELECT kind, COUNT(*) n FROM analysis GROUP BY kind ORDER BY n DESC").all() as any[];
console.log(`\nkind distribution:`);
for (const k of kinds) console.log(`  ${String(k.kind).padEnd(20)} ${k.n}`);

const provs = db.prepare("SELECT provider, model, COUNT(*) n FROM analysis GROUP BY provider, model").all() as any[];
console.log(`\nproviders used:`);
for (const p of provs) console.log(`  ${p.provider} / ${p.model}: ${p.n}`);

const today = todayColombo();
const evs = listEvents({ limit: 900 });
const byStatus = new Map<string, number>();
for (const e of evs) byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + 1);
console.log(`\nevents: ${evs.length}  status=${JSON.stringify([...byStatus])}`);

const next7 = evs.filter((e) => e.event_date && e.event_date >= today && e.event_date <= shiftDate(today, 7));
console.log(`\nnext 7 days (${today} .. ${shiftDate(today, 7)}): ${next7.length}`);
for (const e of next7.slice(0, 20)) {
  console.log(
    `  ${e.event_date} ${(e.event_time ?? "").padEnd(5)} [${e.subject.slice(0, 6)}/${e.class_type}/${e.status}] ${e.title.slice(0, 72)}`,
  );
}

console.log(`\n--- AI read samples ---`);
const samples = db
  .prepare(
    `SELECT a.kind,a.class_type,a.headline,a.detail,a.action,a.event_date,a.event_time,a.confidence,a.provider,m.text,c.username
     FROM analysis a JOIN messages m ON m.id=a.message_id JOIN channels c ON c.id=m.channel_id
     WHERE a.provider NOT IN ('rules','laya') AND a.event_time IS NOT NULL
     ORDER BY m.date DESC LIMIT 8`,
  )
  .all() as any[];
for (const s of samples) {
  console.log(`\n  [${s.kind}/${s.class_type}] ${s.event_date ?? "-"} ${s.event_time ?? "-"} (conf ${s.confidence})`);
  console.log(`    SIN: ${String(s.text).replace(/\s+/g, " ").slice(0, 130)}`);
  console.log(`    EN : ${s.headline}`);
  if (s.action) console.log(`    ACT: ${s.action}`);
}

const tasks = db.prepare("SELECT kind, COUNT(*) n FROM tasks GROUP BY kind").all() as any[];
console.log(`\ntasks: ${tasks.map((t) => `${t.kind}=${t.n}`).join(" ")}`);
db.close();
