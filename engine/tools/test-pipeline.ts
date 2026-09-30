import { db, seedChannels } from "../server/src/db/index.ts";
import { listChannels, storeMessages, markImportantMessages } from "../server/src/db/store.ts";
import { scrapePublicPreview } from "../server/src/telegram/webpreview.ts";
import { runAnalysisQueue, progress } from "../server/src/pipeline/sync.ts";
import { listEvents } from "../server/src/pipeline/project.ts";
import { todayColombo, shiftDate, toColomboDate } from "../server/src/ai/engine.ts";
import { PROVIDERS } from "../server/src/ai/provider.ts";

seedChannels();

const KEY = process.env.CLASSRADAR_TEST_KEY ?? "";
const PROVIDER = process.env.CLASSRADAR_TEST_PROVIDER ?? "openrouter";
if (KEY) {
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.apiKey',?)").run(JSON.stringify(KEY));
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.provider',?)").run(JSON.stringify(PROVIDER));
}

console.log(`provider=${PROVIDER} key=${KEY ? "set" : "MISSING (rules-only mode)"}`);

// Pull a few pages from each previewable channel.
const chans = listChannels().filter((c) => ["RD27T", "RD_27REVISION", "DU27PPR"].includes(c.username));
for (const c of chans) {
  process.stdout.write(`fetching @${c.username} ... `);
  try {
    const page = await scrapePublicPreview(c.username, { pages: 3 });
    const res = storeMessages(c.id, "webpreview", page.messages);
    console.log(`${res.fetched} fetched / ${res.inserted} rows (oldest id ${res.oldestId})`);
  } catch (e) {
    console.log(`ERROR ${(e as Error).message}`);
  }
}
markImportantMessages();

const t0 = Date.now();
const q = await runAnalysisQueue((n) => {
  if (n % 10 === 0) process.stdout.write(`  analysed ${n}...`);
}, 40);
console.log(`\nanalysis: processed=${q.processed} usedAi=${q.usedAi} failed=${q.failed} remaining=${q.remaining} in ${Date.now() - t0}ms`);
if (q.lastError) console.log(`  lastError: ${q.lastError}`);

const today = todayColombo();
const events = listEvents({ limit: 500 });
console.log(`\nevents: ${events.length} total`);
const dated = events.filter((e) => e.event_date);
console.log(`dated events: ${dated.length}`);
for (const e of dated.slice(0, 18)) {
  const when = `${e.event_date} ${e.event_time ?? ""}`.trim();
  console.log(`  ${when.padEnd(18)} [${e.subject}/${e.class_type}/${e.status}] ${e.title.slice(0, 70)}`);
}
const postponed = events.filter((e) => e.status === "postponed");
const cancelled = events.filter((e) => e.status === "cancelled");
console.log(`postponed=${postponed.length} cancelled=${cancelled.length}`);

const kinds = db.prepare("SELECT kind, COUNT(*) n FROM analysis GROUP BY kind ORDER BY n DESC").all() as any[];
console.log(`\nkind distribution:`);
for (const k of kinds) console.log(`  ${String(k.kind).padEnd(20)} ${k.n}`);

const links = db.prepare("SELECT kind, COUNT(*) n FROM links GROUP BY kind ORDER BY n DESC").all() as any[];
console.log(`links: ${links.map((l) => `${l.kind}=${l.n}`).join(" ")}`);

console.log(`\nsample analysed (Sinhala -> English):`);
const samples = db
  .prepare(
    `SELECT a.headline, a.detail, a.action, a.kind, a.urgency, m.text, c.username
     FROM analysis a JOIN messages m ON m.id=a.message_id JOIN channels c ON c.id=m.channel_id
     WHERE a.provider != 'rules' AND LENGTH(a.headline) > 10
     ORDER BY RANDOM() LIMIT 6`,
  )
  .all() as any[];
for (const s of samples) {
  console.log(`\n  @${s.username} [${s.kind}/${s.urgency}]`);
  console.log(`    SIN: ${String(s.text).replace(/\s+/g, " ").slice(0, 150)}`);
  console.log(`    EN : ${s.headline}`);
  if (s.detail) console.log(`    DET: ${s.detail.slice(0, 200)}`);
  if (s.action) console.log(`    ACT: ${s.action}`);
}

db.close();
