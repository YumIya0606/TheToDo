import fs from "node:fs";
import path from "node:path";

/**
 * Distinguishes "the reader is broken" from "my hand-built PDF was invalid" by
 * reading a PDF that is known to be well formed.
 */
const OUT = path.join(process.cwd(), "tools", "pdf-fixtures");
fs.mkdirSync(OUT, { recursive: true });

const URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
const dest = path.join(OUT, "real-sample.pdf");

if (!fs.existsSync(dest)) {
  console.log("fetching a known-good PDF...");
  const res = await fetch(URL);
  if (!res.ok) {
    console.log(`  could not download: HTTP ${res.status}`);
    process.exit(2);
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
console.log(`  have ${dest} (${fs.statSync(dest).size} bytes)\n`);

const { readPdfOnDisk } = await import("../server/src/ai/attachment.ts");

const parsed = await readPdfOnDisk(dest);
if (!parsed) {
  console.log("  FAIL: the reader could not read a known-good PDF");
  process.exit(1);
}
console.log("  PASS: read a known-good PDF");
console.log(`    pages : ${parsed.pages ?? "?"}`);
console.log(`    chars : ${parsed.text.length}`);
console.log(`    text  : ${JSON.stringify(parsed.text.replace(/\s+/g, " ").trim().slice(0, 140))}`);
