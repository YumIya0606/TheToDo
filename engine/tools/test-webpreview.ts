import { scrapePublicPreview, parsePreviewPage, PreviewDisabledError } from "../server/src/telegram/webpreview.ts";
import { db, seedChannels } from "../server/src/db/index.ts";

seedChannels();

const targets = ["RD27T", "RD_27REVISION", "DU27PPR", "DU27T"];

for (const t of targets) {
  const started = Date.now();
  try {
    const page = await scrapePublicPreview(t, { pages: 2 });
    const withText = page.messages.filter((m) => m.text.length > 0);
    const withLinks = page.messages.filter((m) => m.links.length > 0);
    const kinds = new Map<string, number>();
    for (const m of page.messages) for (const l of m.links) kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + 1);
    const sinhala = page.messages.filter((m) => /[\u0D80-\u0DFF]/.test(m.text));
    console.log(
      `✅ @${t.padEnd(16)} ${String(page.messages.length).padStart(3)} msgs / ${withText.length} text / ${withLinks.length} w-links / ${sinhala.length} sinhala in ${Date.now() - started}ms`,
    );
    console.log(`   members=${page.memberCount} more=${page.hasMore} linkKinds=${JSON.stringify([...kinds])}`);
    const sample = page.messages.find((m) => m.text.length > 30);
    if (sample) {
      console.log(`   #${sample.msgId} @${new Date(sample.date * 1000).toISOString()} ${JSON.stringify(sample.text.slice(0, 110))}`);
      if (sample.links.length) console.log(`   links: ${sample.links.map((l) => l.kind + ":" + l.host).join(", ")}`);
    }
  } catch (e) {
    if (e instanceof PreviewDisabledError) console.log(`🔒 @${t.padEnd(16)} ${e.message}`);
    else console.log(`❌ @${t.padEnd(16)} ${(e as Error).message}`);
  }
}
db.close();
