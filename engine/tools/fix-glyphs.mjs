import fs from "node:fs";
import path from "node:path";

/**
 * Explicit repair for the three characters a double round-trip mangled in the
 * UI strings: the ellipsis, the arrow and the middot. The general reverse in
 * fix-encoding.mjs cannot resolve these because the layered encoding produces a
 * byte that is invalid UTF-8 at the innermost level, so they are mapped by hand.
 */
const REPLACEMENTS = [
  ["\u00c3\u00a2\u00e2\u20ac\u00a0\u00e2\u20ac\u2122", "\u2026"], // "…" ellipsis
  ["\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a6", "\u2192"], // "→" arrow
  ["\u00c3\u201a\u00c2\u00b7", "\u00b7"], // "·" middot
  ["\u00c3\u0192\u00c2\u00b7", "\u00b7"], // "·" middot, alternate layer
];

const files = [
  "web/src/pages/Dashboard.tsx",
  "web/src/pages/Library.tsx",
  "web/src/pages/Schedule.tsx",
  "web/src/pages/Settings.tsx",
  "web/src/pages/Messages.tsx",
  "web/src/pages/Tasks.tsx",
  "web/src/pages/Channels.tsx",
  "web/src/components/ui.tsx",
  "web/src/components/keys.tsx",
  "web/src/App.tsx",
  "server/src/index.ts",
  "server/src/ai/engine.ts",
  "server/src/ai/prefilter.ts",
  "README.md",
];

let total = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, "utf8");
  let text = before;
  let n = 0;
  for (const [bad, good] of REPLACEMENTS) {
    const parts = text.split(bad);
    if (parts.length > 1) {
      n += parts.length - 1;
      text = parts.join(good);
    }
  }
  if (text !== before) {
    fs.writeFileSync(f, text, "utf8");
    console.log(`  ${f}: ${n} replacement(s)`);
    total += n;
  }
}
console.log(`\n${total} replacement(s) applied`);
