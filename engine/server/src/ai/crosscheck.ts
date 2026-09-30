import { db, getSetting, setSetting } from "../db/index.js";
import type { Extraction } from "./prompt.js";
import { buildSystemPrompt, buildUserPrompt, parseExtraction } from "./prompt.js";
import type { RuleHints } from "./prefilter.js";
import { colomboNow, toColomboDate, toColomboTime } from "./engine.js";
import { CustomProviderAdapter, getProvider, PROVIDERS, type LlmProvider } from "./provider.js";
import { availableCount, pick, report, classify } from "./keypool.js";
import { chatUrlFor, getCustomProvider, listCustomProviders, poolKey } from "./custom.js";

/**
 * A second opinion on an extraction.
 *
 * The failure that actually hurts is not a bad summary, it is a confident,
 * plausible, wrong class time: a message read as Friday 8:00 when it says
 * Thursday 3:00, and you miss the class. That is invisible in a single reading.
 *
 * So the same message is read again by a different model, and the two structured
 * results are compared field by field. Agreement raises confidence and is
 * silent. Disagreement is recorded and surfaced, so the student can check that
 * one message rather than distrusting the whole backlog.
 */

export interface CrossCheckConfig {
  enabled: boolean;
  /** Pool namespace of the verifying connection, e.g. "openrouter". */
  provider: string;
  /** Blank means "whatever the provider recommends". */
  model: string;
}

export function crossCheckConfig(): CrossCheckConfig {
  return {
    enabled: getSetting("xcheck.enabled", false) as boolean,
    provider: getSetting("xcheck.provider", "") as string,
    model: getSetting("xcheck.model", "") as string,
  };
}

export function saveCrossCheckConfig(c: Partial<CrossCheckConfig>): CrossCheckConfig {
  if (c.enabled !== undefined) setSetting("xcheck.enabled", c.enabled);
  if (c.provider !== undefined) setSetting("xcheck.provider", c.provider);
  if (c.model !== undefined) setSetting("xcheck.model", c.model);
  return crossCheckConfig();
}

/** Connections that can verify: anything with a usable key, or a keyless tier. */
export function verifierOptions(): Array<{ id: string; label: string; usable: boolean }> {
  const out: Array<{ id: string; label: string; usable: boolean }> = [];
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (id === "none") continue;
    if (id === "kiloFree") {
      out.push({ id, label: p.label, usable: true });
      continue;
    }
    out.push({ id, label: p.label, usable: availableCount(id) > 0 });
  }
  for (const cp of listCustomProviders()) {
    const ns = poolKey(cp.id);
    out.push({
      id: ns,
      label: `${cp.name} (custom)`,
      usable: availableCount(ns) > 0 || Boolean(cp.apiKey),
    });
  }
  return out;
}

/** Fields whose disagreement actually changes what the student would do. */
const COMPARE_FIELDS: Array<keyof Extraction> = [
  "kind",
  "class_type",
  "event_date",
  "event_time",
  "booster_episode",
  "question_count",
  "tute_name",
];

export interface CrossCheckResult {
  messageId: number;
  agreed: boolean;
  disagreements: string[];
  primaryModel: string;
  verifierModel: string;
  /** True when the verifier itself could not be run (no key, rate limit). */
  skipped?: boolean;
  reason?: string;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/** Read the same message again with a different model. */
async function readAgain(
  ctx: { channelTitle: string; channelKind: string; subject: string; text: string; messageDate: string; hints: RuleHints },
  cfg: CrossCheckConfig,
): Promise<{ extraction: Extraction; model: string } | { skipped: true; reason: string }> {
  const id = cfg.provider;
  if (!id) return { skipped: true, reason: 'No verification connection is chosen.' };

  let apiKey: string | undefined;
  let model = cfg.model || undefined;
  // A custom endpoint has no entry in the PROVIDERS registry, so it needs its
  // own adapter. Resolving by id alone silently produced a disabled provider,
  // which is why verification was being skipped.
  let provider: LlmProvider;

  if (id.startsWith("custom:")) {
    const cp = getCustomProvider(Number(id.slice("custom:".length)));
    if (!cp) return { skipped: true, reason: "That endpoint no longer exists." };
    const ns = poolKey(cp.id);
    const pooled = pick(ns);
    apiKey = pooled?.key ?? cp.apiKey ?? undefined;
    model = cfg.model || cp.model || undefined;
    provider = new CustomProviderAdapter(
      `custom:${cp.id}`,
      cp.name,
      cp.model,
      chatUrlFor(cp.baseUrl),
      cp.baseUrl
    );
  } else {
    provider = getProvider(id);
    // A connection that needs no key at all (a gateway's own free tier) must not
    // be gated on having a key in the pool, or it can never verify anything.
    if (provider.requiresKey && availableCount(id) === 0) {
      return { skipped: true, reason: `No usable key for ${provider.label} right now.` };
    }
    if (provider.requiresKey) {
      const pooled = pick(id);
      apiKey = pooled?.key;
    }
    model = cfg.model || provider.defaultModel;
  }

  const call = async (maxTokens: number) =>
    provider.complete(
      {
        messages: [
          {
            role: "system",
            content: buildSystemPrompt({
              channelTitle: ctx.channelTitle,
              channelKind: ctx.channelKind,
              subject: ctx.subject,
              nowColombo: colomboNow().label,
            }),
          },
          {
            role: "user",
            content: buildUserPrompt({
              text: ctx.text,
              hasMedia: false,
              mediaName: null,
              mediaKind: null,
              attachmentExcerpt: null,
              isForwarded: false,
              forwardFrom: null,
              messageDate: ctx.messageDate,
              hints: ctx.hints,
            }),
          },
        ],
        temperature: 0,
        maxTokens,
        model,
        jsonMode: true,
        disableReasoning: true,
        timeoutMs: 90_000,
      },
      apiKey
    );

  try {
    let res = await call(2000);
    try {
      return { extraction: parseExtraction(res.text), model: res.model };
    } catch (parseErr) {
      // A reasoning model that ignored the suppression flag can spend the whole
      // budget thinking and never reach the JSON. Give it room once, exactly as
      // the primary path does, rather than recording a false disagreement.
      if (!/no JSON|empty/i.test((parseErr as Error).message)) throw parseErr;
      res = await call(6000);
      return { extraction: parseExtraction(res.text), model: res.model };
    }
  } catch (err) {
    const message = (err as Error).message;
    if (apiKey) {
      const pooled = pick(id);
      if (pooled) report(pooled.id, classify(message), message);
    }
    return { skipped: true, reason: message.slice(0, 200) };
  }
}

/**
 * Verify one extraction. Returns without recording anything when the feature is
 * off or the verifier is unavailable — a cross-check must never be able to fail
 * the primary extraction.
 */
export async function crossCheck(
  messageId: number,
  primary: Extraction,
  primaryProvider: string,
  primaryModel: string,
  ctx: {
    channelTitle: string;
    channelKind: string;
    subject: string;
    text: string;
    date: number;
    hints: RuleHints;
  },
): Promise<CrossCheckResult | null> {
  const cfg = crossCheckConfig();
  if (!cfg.enabled || !cfg.provider) return null;

  // Verifying with the same model the primary used proves nothing.
  if (!cfg.provider.startsWith("custom:") && cfg.provider === primaryProvider && !cfg.model) {
    return null;
  }

  const again = await readAgain(
    {
      channelTitle: ctx.channelTitle,
      channelKind: ctx.channelKind,
      subject: ctx.subject,
      text: ctx.text,
      messageDate: `${toColomboDate(ctx.date)} ${toColomboTime(ctx.date)}`,
      hints: ctx.hints,
    },
    cfg
  );

  if ("skipped" in again) {
    // A verifier that cannot be reached is a real problem worth seeing, but it
    // must not look like a disagreement.
    console.warn(`[theTodo:engine] cross-check skipped for message ${messageId}: ${again.reason}`);
    return {
      messageId,
      agreed: true,
      disagreements: [],
      primaryModel,
      verifierModel: cfg.model || cfg.provider,
      skipped: true,
      reason: again.reason,
    };
  }

  const disagreements: string[] = [];
  for (const f of COMPARE_FIELDS) {
    if (!sameValue(primary[f], again.extraction[f])) {
      const before = primary[f] ?? "-";
      const after = again.extraction[f] ?? "-";
      // Show the actual values, not just the field name: the student needs to
      // see WHICH reading is wrong to judge it, and "event_time" alone does not.
      disagreements.push(`${String(f)}: ${String(before)} vs ${String(after)}`);
    }
  }
  const agreed = disagreements.length === 0;

  db.prepare(
    `INSERT INTO crosscheck
       (message_id, primary_provider, primary_model, primary_json, verifier_provider, verifier_model,
        verifier_json, agreed, disagreements, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(message_id) DO UPDATE SET
       primary_provider=excluded.primary_provider, primary_model=excluded.primary_model,
       primary_json=excluded.primary_json, verifier_provider=excluded.verifier_provider,
       verifier_model=excluded.verifier_model, verifier_json=excluded.verifier_json,
       agreed=excluded.agreed, disagreements=excluded.disagreements, created_at=excluded.created_at`,
  ).run(
    messageId,
    primaryProvider,
    primaryModel,
    JSON.stringify(primary),
    cfg.provider,
    again.model,
    JSON.stringify(again.extraction),
    agreed ? 1 : 0,
    disagreements.join(","),
    Date.now(),
  );

  return {
    messageId,
    agreed,
    disagreements,
    primaryModel,
    verifierModel: again.model,
  };
}

/** How the cross-check is going, for the dashboard. */
export interface CrossCheckSummary {
  checked: number;
  agreed: number;
  disagreed: number;
  recent: Array<{
    messageId: number;
    headline: string;
    text: string;
    username: string;
    agreed: boolean;
    disagreements: string;
    primaryModel: string;
    verifierModel: string;
  }>;
}

export function crossCheckSummary(limit = 20): CrossCheckSummary {
  const row = db
    .prepare(
      `SELECT COUNT(*) checked, SUM(agreed) agreed FROM crosscheck`,
    )
    .get() as { checked: number; agreed: number | null };
  const agreed = row.agreed ?? 0;
  const recent = db
    .prepare(
      `SELECT c.message_id, c.agreed, c.disagreements, c.primary_model, c.verifier_model,
              a.headline, m.text, ch.username
       FROM crosscheck c
       LEFT JOIN analysis a ON a.message_id = c.message_id
       LEFT JOIN messages m ON m.id = c.message_id
       LEFT JOIN channels ch ON ch.id = m.channel_id
       ORDER BY c.created_at DESC LIMIT ?`,
    )
    .all(limit) as any[];
  return {
    checked: row.checked,
    agreed,
    disagreed: row.checked - agreed,
    recent: recent.map((r) => ({
      messageId: r.message_id,
      headline: r.headline ?? "",
      text: String(r.text ?? "").replace(/\s+/g, " ").slice(0, 180),
      username: r.username ?? "",
      agreed: Boolean(r.agreed),
      disagreements: r.disagreements ?? "",
      primaryModel: r.primary_model,
      verifierModel: r.verifier_model,
    })),
  };
}
