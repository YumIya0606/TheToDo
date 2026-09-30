/**
 * Reports the free-model catalogue of a connection, ranked for Sinhala, so it is
 * obvious which model ClassRadar would choose and why.
 */
import { addKey, listKeys, revive } from "../server/src/ai/keypool.ts";
import { describeConnection } from "../server/src/ai/connections.ts";

const targets = process.argv.slice(2);

for (const id of targets) {
  console.log(`\n=== ${id} ===`);
  try {
    const c = await describeConnection(id);
    if (!c) {
      console.log("  not found");
      continue;
    }
    console.log(`  name       ${c.name}`);
    console.log(`  baseUrl    ${c.baseUrl ?? "(built-in)"}`);
    console.log(`  keys       ${c.keySummary.total} (${c.keySummary.available} ready)`);
    console.log(`  current    ${c.model || "(none)"}`);
    console.log(`  suggested  ${c.suggestedModel ?? "(none)"}`);
    if (c.modelsWarning) console.log(`  warning    ${c.modelsWarning}`);
    const free = c.models.filter((m) => m.isFree);
    console.log(`  catalogue  ${c.models.length} models, ${free.length} free`);
    console.log("  best 12 for Sinhala:");
    for (const m of c.models.slice(0, 12)) {
      console.log(`    ${m.isFree ? "free " : "     "} ${m.id.padEnd(42)} ${m.why ?? ""}`);
    }
  } catch (e) {
    console.log(`  error: ${(e as Error).message}`);
  }
}
