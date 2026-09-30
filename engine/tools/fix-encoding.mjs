import fs from "node:fs";
import path from "node:path";
import { toBytes } from "./cp1252.mjs";

/**
 * Repair double-encoded (mojibake) UTF-8 in source files.
 *
 * A shell round trip that read UTF-8 bytes as Latin-1 and wrote them back as
 * UTF-8 turns one arrow glyph into three Latin-1 characters, which are then
 * themselves re-encoded. The repair reverses that layer by layer: encode the
 * mojibake back to bytes using the Windows-1252 code page, then decode as UTF-8.
 *
 * A document is only ever accepted when the reversal provably reduces the number
 * of markers, produces no replacement characters and yields no control
 * characters, so correct text is never modified.
 */

const ROOT = process.argv[2] ?? ".";
const DIRS = ["server", "web", "shared", "tools", "electron"];
const EXTS = new Set([".ts", ".tsx", ".cjs", ".mjs", ".js", ".json", ".md", ".css", ".html", ".sql", ".bat", ".ps1"]);

/** Sequences that only ever appear as the result of a bad decode. */
const MARKERS = [
  "\u00e2\u20ac", // â€ - smart quotes, dashes, ellipsis
  "\u00c3\u00a2", // â - the next layer of the above
  "\u00c3\u00a9", // é
  "\u00c3\u0097", // Ã—
  "\u00c3\u00bc", // ü
  "\u00c3\u00a4", // ä
  "\u00c3\u00b6", // ö
  "\u00c2 ", // Â + non-breaking space
  "\u00c2\u00b7", // ·
  "\u00c2\u00b0", // °
  "\u00ef\u00bb\u00bf", // BOM
];

function countMarkers(s) {
  let n = 0;
  for (const m of MARKERS) {
    let i = s.indexOf(m);
    while (i !== -1) {
      n++;
      i = s.indexOf(m, i + m.length);
    }
  }
  return n;
}

/** Reverse one round of double encoding, or return null if it would not help. */
function repair(text) {
  if (countMarkers(text) === 0) return null;
  try {
    const bytes = Buffer.from(text, "cp1252");
    const fixed = bytes.toString("utf8");
    // A valid reversal must strictly reduce the marker count, and must not
    // introduce replacement characters from a botched decode.
    if (fixed.includes("\uFFFD")) return null;
    return countMarkers(fixed) < countMarkers(text) ? fixed : null;
  } catch {
    return null;
  }
}

/**
 * Characters that a UTF-8 byte sequence turns into when decoded as cp1252.
 * Mojibake is always a run of these, so a run can be repaired on its own
 * without touching correctly encoded text elsewhere in the file.
 */
const CP1252_HIGHER = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2030, 0x201c, 0x201d, 0x2018, 0x2019, 0x201a, 0x2020,
  0x2021, 0x2022, 0x2026, 0x2039, 0x203a, 0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d,
  0x017e, 0x0192, 0x02c6, 0x02dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d,
]);

function isMojibakeChar(cp) {
  return (cp >= 0x80 && cp <= 0xbf) || (cp >= 0xc0 && cp <= 0xff) || CP1252_HIGHER.has(cp);
}

/** Repair one run of mojibake characters, or return it unchanged. */
function repairRun(run) {
  if (!countMarkers(run)) return run;
  const bytes = toBytes(run);
  if (!bytes) return run;
  const fixed = bytes.toString("utf8");
  if (fixed.includes("\uFFFD")) return run;
  // Only accept the reversal if it genuinely removed the markers and produced
  // sane text rather than control characters.
  if (countMarkers(fixed) >= countMarkers(run)) return run;
  if (hasControlChars(fixed)) return run;
  return fixed;
}

/** Reject a "fix" that produced control characters rather than text. */
function hasControlChars(s) {
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0x09 || cp === 0x0a || cp === 0x0d) continue;
    if (cp < 0x20) return true;
  }
  return false;
}

/** Repair every mojibake run in a document, leaving everything else alone. */
function repairDocument(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (isMojibakeChar(text.codePointAt(i))) {
      let j = i;
      while (j < text.length && isMojibakeChar(text.codePointAt(j))) j++;
      out += repairRun(text.slice(i, j));
      i = j;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

/** Every file under `dir`, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

let filesScanned = 0;
let filesFixed = 0;
let totalMarkers = 0;

for (const dir of DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of walk(full)) {
    if (!EXTS.has(path.extname(file))) continue;
    filesScanned++;
    const original = fs.readFileSync(file, "utf8");
    const before = countMarkers(original);
    if (before === 0) continue;
    totalMarkers += before;
    const fixed = repairDocument(original);
    if (fixed === original) {
      console.log(`  unrepairable ${path.relative(ROOT, file)} (${before} markers)`);
      continue;
    }
    fs.writeFileSync(file, fixed, "utf8");
    filesFixed++;
    console.log(`  fixed ${path.relative(ROOT, file)}: ${before} -> ${countMarkers(fixed)}`);
  }
}

console.log(`\nscanned ${filesScanned} files, ${totalMarkers} markers found, ${filesFixed} file(s) repaired`);
if (totalMarkers > 0 && filesFixed === 0) process.exit(1);
