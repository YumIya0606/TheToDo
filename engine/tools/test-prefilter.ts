import { ruleHints, isNoise, backfillDepth } from "../server/src/ai/prefilter.ts";

/** Confirms the Sinhala keyword pre-filter actually matches real messages. */
const CASES: Array<[string, string, boolean]> = [
  ["උදේ 8.00 ට පාඩම පටන් ගන්නවා", "morning class time", true],
  ["හෙට සවස 1.00 ට revision class", "tomorrow afternoon revision", true],
  ["අද රාත්‍රී 8.00 ට booster", "tonight booster", true],
  ["දිගලා හෙටට දිගලා", "postponed", true],
  ["වෙනුවට පරීක්ෂණයක්", "instead test", true],
  ["Join the Zoom link now", "zoom", true],
  ["YouTube premiere link", "youtube", true],
  ["පත්‍ර 02 essay online", "paper", true],
  ["Good morning everyone", "greeting only", false],
  ["😀😀😀", "emoji only", false],
  ["ok", "tiny", false],
];

let pass = 0;
for (const [text, label, expectRelevant] of CASES) {
  const h = ruleHints(text);
  const noise = isNoise(text);
  const ok = expectRelevant ? h.likelyRelevant && !noise : true;
  if (ok) pass++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(26)} relevant=${String(h.likelyRelevant).padEnd(5)} time=${String(h.hasTime).padEnd(5)} date=${String(h.hasDate).padEnd(5)} class=${String(h.looksLikeClass).padEnd(5)} late=${String(h.looksPostponed).padEnd(5)} noise=${noise}`,
  );
}
console.log(`\n${pass}/${CASES.length} prefilter checks passed`);
console.log(`backfillDepth: 7d=${backfillDepth(7)} 30d=${backfillDepth(30)} 90d=${backfillDepth(90)}`);
