/**
 * Repair key pools that were polluted by the legacy-migration bug, where the one
 * Google key was copied into every custom endpoint as a "migrated" row. A Google
 * key can never authenticate against an OpenAI-compatible reseller, so those
 * copies are dead weight that only produce 401s and skew the key summary.
 *
 * Usage: npx tsx tools/fix-keypools.ts [--apply]
 */
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const DATA_DIR =
  process.env.CLASSRADAR_DATA_DIR ?? path.join(process.env.APPDATA ?? "", "ClassRadar", "data");
process.env.CLASSRADAR_DATA_DIR = DATA_DIR;

const { db, getSetting } = await import("../server/src/db/index.ts");

const rows = db
  .prepare(
    `SELECT k.id, k.provider, k.label, k.key_value, k.used_count, k.ok_count
     FROM api_keys k
     WHERE k.provider LIKE 'custom:%' AND k.label = 'migrated'
     ORDER BY k.id`,
  )
  .all() as any[];

if (!rows.length) {
  console.log("nothing to clean: no migrated keys inside custom endpoints");
  db.close();
} else {
  console.log(`${rows.length} legacy key(s) copied into custom endpoints:\n`);
  for (const r of rows) {
    console.log(
      `  [${r.provider}] ${r.masked ?? ""} label=${r.label} used=${r.used_count} ok=${r.ok_count}`,
    );
  }
  if (APPLY) {
    const info = db
      .prepare("DELETE FROM api_keys WHERE provider LIKE 'custom:%' AND label = 'migrated'")
      .run();
    console.log(`\nremoved ${info.changes} row(s)`);
  } else {
    console.log("\nnothing changed. Re-run with --apply to remove them.");
  }
}

// Make sure the one-time migration flag is set, so it cannot run again.
console.log(`\nkeyInPool flag = ${JSON.stringify(getSetting("ai.keyInPool", false))}`);
console.log(`active connection = ${getSetting("ai.provider", "?")}`);
db.close();
