import fs from "node:fs";
import path from "node:path";

/** Check every source file for Sinhala text that survived encoding damage. */
const ROOT = ".";
const DIRS = ["server", "web", "shared", "tools"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Mojibake that specifically indicates damaged Sinhala: the lead bytes of every
// Sinhala UTF-8 sequence are E0/E1, which decode as a-tilde / a-acute.
const BROKEN = /[\u00e0-\u00e3][\u00a0-\u00bf\u0152\u0153\u0160\u0161\u017d\u017e\u0178\u0192\u201a\u2039\u203a\u02c6\u2030]?/g;
const GOOD_SINHALA = /[\u0d80-\u0dff]/g;

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of walk(dir)) {
    if (!/\.(ts|tsx|cjs|mjs|sql|md)$/.test(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    const good = (t.match(GOOD_SINHALA) ?? []).length;
    const bad = (t.match(BROKEN) ?? []).length;
    if (bad > 0) {
      const lines = t.split("\n");
      const hits: Array<[number, string]> = [];
      for (let i = 0; i < lines.length; i++) {
        BROKEN.lastIndex = 0;
        if (BROKEN.test(lines[i])) hits.push([i + 1, lines[i]]);
        if (hits.length >= 4) break;
      }
      console.log(`DAMAGED ${f}  goodSinhala=${good} brokenRuns=${bad}`);
      for (const [n, l] of hits) console.log(`    ${n}: ${l.trim().slice(0, 100)}`);
    } else if (good > 0) {
      console.log(`ok      ${f}  goodSinhala=${good}`);
    }
  }
}
