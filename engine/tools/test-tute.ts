import path from "node:path";

const DATA_DIR =
  process.env.CLASSRADAR_DATA_DIR ?? path.join(process.env.APPDATA ?? "", "ClassRadar", "data");
process.env.CLASSRADAR_DATA_DIR = DATA_DIR;

const { db } = await import("../server/src/db/index.ts");
const { analyzeMessage, aiSettings } = await import("../server/src/ai/engine.ts");

// Physics theory posts, newest first: these carry the tute and the questions.
const rows = db
  .prepare(
    `SELECT m.*, c.username, c.title AS channel_title, c.subject, c.accent, c.kind AS channel_kind
     FROM messages m JOIN channels c ON c.id = m.channel_id
     WHERE c.username = 'DU27T' AND LENGTH(m.text) > 40
     ORDER BY m.date DESC LIMIT 4`,
  )
  .all() as any[];

const settings = aiSettings();
console.log(`primary: ${settings.provider} / ${settings.model || "(default)"}\n`);

for (const r of rows) {
  db.prepare("DELETE FROM analysis WHERE message_id = ?").run(r.id);
  const msg = {
    ...r,
    channel: {
      username: r.username,
      title: r.channel_title,
      subject: r.subject,
      accent: r.accent,
      kind: r.channel_kind,
    },
  };
  try {
    await analyzeMessage(msg as never, settings);
  } catch (e) {
    console.log(`  [${r.msg_id}] failed: ${(e as Error).message.slice(0, 110)}\n`);
  }
}

for (const r of db
  .prepare(
    `SELECT a.*, m.text FROM analysis a JOIN messages m ON m.id = a.message_id
     WHERE a.message_id IN (${rows.map(() => "?").join(",")}) ORDER BY m.date DESC`,
  )
  .all(...rows.map((x) => x.id)) as any[]) {
  console.log(`[${r.kind}] ${r.model}`);
  console.log(`  SIN  : ${String(r.text).replace(/\s+/g, " ").slice(0, 140)}`);
  console.log(`  EN   : ${r.headline}`);
  let nums: number[] = [];
  try {
    nums = r.question_numbers ? JSON.parse(r.question_numbers) : [];
  } catch {
    nums = [];
  }
  console.log(`  TUTE : ${r.tute_name ?? "-"}${nums.length ? "" : "   <-- check"}`);
  console.log(`  BOOST: ${r.booster_kind ?? "-"} ep ${r.booster_episode ?? "-"}`);
  if (nums.length) {
    console.log(`  Q    : ${nums.length} questions -> ${nums.join(", ")}`);
  } else {
    console.log(`  Q    : (none)`);
  }
  console.log(`  when : ${r.event_date ?? "-"} ${r.event_time ?? "-"}\n`);
}

db.close();
