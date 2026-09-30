import { Database } from "../server/src/db/driver.ts";
import fs from "node:fs";
import path from "node:path";

const file =
  process.env.CLASSRADAR_DB ??
  path.join(process.env.CLASSRADAR_DATA_DIR ?? "data", "classradar.db");

if (!fs.existsSync(file)) {
  console.log(`no database yet at ${file}`);
  process.exit(0);
}

const db = new Database(file);
const one = (sql: string) => db.prepare(sql).get() as { n: number; t: number };

const m = one("SELECT COUNT(*) n FROM messages").n;
const t = one("SELECT COUNT(*) n FROM analysis").n;
const e = one("SELECT COUNT(*) n FROM analysis WHERE provider='error'").n;
const r = one("SELECT COUNT(*) n FROM analysis WHERE provider='rules'").n;

console.log(`database: ${file}`);
console.log(
  `messages=${m}  understood=${t} (ai=${t - e - r} rules=${r} failed=${e})  waiting=${m - t}`,
);
console.log(`events=${one("SELECT COUNT(*) n FROM events").n}  links=${one("SELECT COUNT(*) n FROM links").n}  tasks=${one("SELECT COUNT(*) n FROM tasks").n}`);

const range = db
  .prepare(
    `SELECT MIN(m.date) a, MAX(m.date) b FROM messages m`,
  )
  .get() as { a: number; b: number };
if (range.a) {
  const f = (x: number) => new Date(x * 1000).toISOString().slice(0, 16);
  console.log(`history: ${f(range.a)} .. ${f(range.b)}`);
}

db.close();
