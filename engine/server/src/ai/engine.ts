import { db, getSetting } from "../db/index.js";
import type {
  Analysis,
  Channel,
  Message,
  MessageKind,
  Subject,
} from "../../../../shared/types.js";
import { getProvider, layaTriage } from "./provider.js";
import { resolveProvider, completeWithPool } from "./rotate.js";
import { isNoise, ruleHints, type RuleHints } from "./prefilter.js";
import { isImageKind } from "./attachment.js";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseExtraction,
  PROMPT_VERSION,
  type Extraction,
} from "./prompt.js";

/* Colombo is UTC+5:30 with no daylight saving. */
const COLOMBO_OFFSET_MIN = 330;
const nowColombo = () => new Date(Date.now() + COLOMBO_OFFSET_MIN * 60_000);

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toColomboDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000 + COLOMBO_OFFSET_MIN * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function toColomboTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000 + COLOMBO_OFFSET_MIN * 60_000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function colomboNow(): { date: string; time: string; label: string } {
  const d = nowColombo();
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return { date, time, label: `${date} ${time}` };
}

export function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayColombo(): string {
  return colomboNow().date;
}

/* ---------------------------------------------------------------- settings */

export interface AiSettings {
  provider: string;
  apiKey: string;
  model: string;
  batchSize: number;
  maxTokens: number;
  temperature: number;
  requestTimeoutMs: number;
  concurrency: number;
  useLayaTriage: boolean;
  layaEndpoint: string;
  autoSyncMinutes: number;
  autoSyncEnabled: boolean;
}

export function aiSettings(): AiSettings {
  return {
    provider: getSetting("ai.provider", "gemini"),
    apiKey: getSetting("ai.apiKey", ""),
    model: getSetting("ai.model", ""),
    batchSize: getSetting("ai.batchSize", 12),
    maxTokens: getSetting("ai.maxTokens", 2000),
    temperature: getSetting("ai.temperature", 0.1),
    requestTimeoutMs: getSetting("ai.timeoutMs", 45_000),
    concurrency: getSetting("ai.concurrency", 3),    useLayaTriage: getSetting("ai.useLayaTriage", false),
    layaEndpoint: getSetting("ai.layaEndpoint", ""),
    autoSyncMinutes: getSetting("sync.minutes", 15),
    autoSyncEnabled: getSetting("sync.auto", false),
  };
}

/** True when a model can actually be called right now: a provider is selected
 *  and at least one key for it is usable. */
export function providerReady(s: AiSettings = aiSettings()): boolean {
  try {
    const choice = resolveProvider();
    if (!choice) return false;
    if (!choice.provider.requiresKey) return true;
    return choice.available > 0;
  } catch {
    // Fall back to the legacy single-key setting if the pool is empty.
    return getProvider(s.provider).isConfigured(s.apiKey);
  }
}
/* ------------------------------------------------------ rules-only fallback */

/** Deterministic extraction used when no AI provider is configured. */
export function rulesOnlyExtraction(
  msg: Omit<Message, "links"> & { links?: Array<{ kind: string }> },
  channel: Channel,
): Extraction | null {
  const h = ruleHints(msg.text);
  const links = (msg.links ?? []).map((l: { kind: string }) => l.kind);
  const when = toColomboDate(msg.date);
  const time = toColomboTime(msg.date);

  let kind: MessageKind = "general_notice";
  if (h.looksPostponed) kind = "postponement";
  else if (links.includes("zoom")) kind = "join_link";
  else if (links.includes("youtube")) kind = "recording";
  else if (msg.media_kind === "document") kind = "material";
  else if (h.looksLikeClass) kind = "class_announcement";
  else if (!h.likelyRelevant) return null;

  const classType = classifyByText(msg.text, channel.kind);

  return {
    kind,
    class_type: classType,
    subject: channel.subject,
    headline: `${channel.title.split("|")[0].trim()} — ${kind.replace(/_/g, " ")}`,
    detail: msg.text.slice(0, 400),
    action: null,
    urgency: h.hasZoom ? "high" : "normal",
    status_change: h.looksPostponed ? "postponed" : "scheduled",
    event_date: when,
    event_time: time,
    event_end_time: null,
    is_full_syllabus: false,
    tute_name: null,
    question_numbers: null,
    question_count: null,
    booster_kind: null,
    booster_episode: null,
    confidence: 0.25,
  };
}

function classifyByText(text: string, fallback: string): Extraction["class_type"] {
  const t = text.toLowerCase();
  if (/(revision|ශේෂ)/.test(t)) return "revision";
  if (/(extra|අමතර)/.test(t)) return "extra";
  if (/(paper|පත්‍ර)/.test(t)) return "paper";
  if (/(booster|program online|කාච)/.test(t)) return "booster";
  if (/(seminar|සම්මේලන)/.test(t)) return "seminar";
  if (/(theory|න්‍යාස)/.test(t)) return "theory";
  return (fallback as Extraction["class_type"]) ?? "other";
}

/* ------------------------------------------------------------- persistence */

export function saveAnalysis(messageId: number, e: Extraction, provider: string, model: string): void {
  db.prepare(
    `INSERT INTO analysis
       (message_id, provider, model, prompt_version, kind, class_type, subject, headline, detail,
        action, urgency, status_change, event_date, event_time, event_end_time, is_full_syllabus,
        tute_name, question_numbers, question_count, booster_kind, booster_episode,
        confidence, raw_json, analyzed_at)
     VALUES (@message_id, @provider, @model, @prompt_version, @kind, @class_type, @subject, @headline,
        @detail, @action, @urgency, @status_change, @event_date, @event_time, @event_end_time,
        @is_full_syllabus, @tute_name, @question_numbers, @question_count, @booster_kind,
        @booster_episode, @confidence, @raw_json, @analyzed_at)
     ON CONFLICT(message_id) DO UPDATE SET
       provider=excluded.provider, model=excluded.model, prompt_version=excluded.prompt_version,
       kind=excluded.kind, class_type=excluded.class_type, subject=excluded.subject,
       headline=excluded.headline, detail=excluded.detail, action=excluded.action,
       urgency=excluded.urgency, status_change=excluded.status_change, event_date=excluded.event_date,
       event_time=excluded.event_time, event_end_time=excluded.event_end_time,
       is_full_syllabus=excluded.is_full_syllabus,
       tute_name=excluded.tute_name, question_numbers=excluded.question_numbers,
       question_count=excluded.question_count,
       booster_kind=excluded.booster_kind, booster_episode=excluded.booster_episode,
       confidence=excluded.confidence, raw_json=excluded.raw_json, analyzed_at=excluded.analyzed_at`,
  ).run({
    message_id: messageId,
    provider,
    model,
    prompt_version: PROMPT_VERSION,
    kind: e.kind,
    class_type: e.class_type,
    subject: e.subject,
    headline: e.headline.slice(0, 200),
    detail: e.detail,
    action: e.action,
    urgency: e.urgency,
    status_change: e.status_change,
    event_date: e.event_date,
    event_time: e.event_time,
    event_end_time: e.event_end_time,
    is_full_syllabus: e.is_full_syllabus ? 1 : 0,
    tute_name: e.tute_name,
    question_numbers: e.question_numbers ? JSON.stringify(e.question_numbers) : null,
    question_count:
      e.question_count ?? (e.question_numbers ? e.question_numbers.length : null),
    booster_kind: e.booster_kind,
    booster_episode: e.booster_episode,
    confidence: e.confidence,
    raw_json: JSON.stringify(e),
    analyzed_at: Date.now(),
  });
}

export function markImportant(messageId: number, important: boolean): void {
  db.prepare("UPDATE messages SET is_important = ? WHERE id = ?").run(important ? 1 : 0, messageId);
}

/* --------------------------------------------------------- analyze one msg */

export interface AnalyzeResult {
  messageId: number;
  ok: boolean;
  usedAi: boolean;
  kind: MessageKind | null;
  error?: string;
  latencyMs?: number;
}

export interface AnalyzableMessage extends Omit<Message, "links"> {
  channel: Channel;
  links?: Array<{ url: string; kind: string; host: string }>;
}

export async function analyzeMessage(
  msg: AnalyzableMessage,
  settings = aiSettings(),
): Promise<AnalyzeResult> {
  const channel = msg.channel;

  if (isNoise(msg.text)) {
    const skip: Extraction = {
      kind: "reaction",
      class_type: null,
      subject: channel.subject,
      headline: "",
      detail: "",
      action: null,
      urgency: "low",
      status_change: null,
      event_date: null,
      event_time: null,
      event_end_time: null,
      is_full_syllabus: false,
    tute_name: null,
    question_numbers: null,
    question_count: null,
    booster_kind: null,
    booster_episode: null,
      confidence: 1,
    };
    saveAnalysis(msg.id, skip, "rules", "noise");
    return { messageId: msg.id, ok: true, usedAi: false, kind: "reaction" };
  }

  const hints = ruleHints(msg.text);

  // Optional cheap Laya triage: skip obvious chat before spending an LLM call.
  if (settings.useLayaTriage && settings.layaEndpoint) {
    const t = await layaTriage(settings.layaEndpoint, msg.text);
    if (t && !t.relevant && t.confidence > 0.9) {
      const skip: Extraction = {
        kind: "chat",
        class_type: null,
        subject: channel.subject,
        headline: "",
        detail: "",
        action: null,
        urgency: "low",
        status_change: null,
        event_date: null,
        event_time: null,
        event_end_time: null,
        is_full_syllabus: false,
    tute_name: null,
    question_numbers: null,
    question_count: null,
    booster_kind: null,
    booster_episode: null,
        confidence: 0.9,
      };
      saveAnalysis(msg.id, skip, "laya", "triage");
      return { messageId: msg.id, ok: true, usedAi: false, kind: "chat" };
    }
    if (t?.relevant && t.kind && t.confidence > 0.85) {
      hints.looksLikeClass = true;
      hints.likelyRelevant = true;
    }
  }

  // Resolve through the pool: this picks the provider, and hands back a live
  // count of how many of its keys are usable right now.
  const choice = resolveProvider();
  const ready = Boolean(choice && (choice.available > 0 || !choice.provider.requiresKey));

  if (!choice || !ready) {
    const fallback = rulesOnlyExtraction(msg, channel);
    if (!fallback) {
      saveAnalysis(
        msg.id,
        {
          kind: "irrelevant",
          class_type: null,
          subject: channel.subject,
          headline: "",
          detail: "",
          action: null,
          urgency: "low",
          status_change: null,
          event_date: null,
          event_time: null,
          event_end_time: null,
          is_full_syllabus: false,
    tute_name: null,
    question_numbers: null,
    question_count: null,
    booster_kind: null,
    booster_episode: null,
          confidence: 0,
        },
        "rules",
        "skipped",
      );
      return { messageId: msg.id, ok: true, usedAi: false, kind: "irrelevant" };
    }
    saveAnalysis(msg.id, fallback, "rules", "rules-only");
    return { messageId: msg.id, ok: true, usedAi: false, kind: fallback.kind };
  }

  const now = colomboNow();
  const provider = choice.provider;

  // Read any attached document here rather than sending the file. Cached, so a
  // re-read of the same message costs nothing, and never more than a short
  // excerpt ever reaches a prompt.
  let attachmentExcerpt: string | null = null;
  if (msg.has_media && !isImageKind(msg.media_kind)) {
    try {
      const { ensureAttachmentText } = await import("./attachment.js");
      const doc = await ensureAttachmentText(msg.id);
      if (doc?.ok && doc.excerpt) attachmentExcerpt = doc.excerpt;
    } catch {
      /* an unreadable attachment just means less context, not a failure */
    }
  }
  // Gemini's free Flash tier routinely takes 25-40s for a single short JSON
  // answer, so it needs a longer leash and more parallel workers than the
  // OpenAI-compatible providers, which answer in 2-8s.
  const slowProvider = provider.id === "gemini";
  const requestTimeout = slowProvider
    ? Math.max(settings.requestTimeoutMs, 120_000)
    : settings.requestTimeoutMs;

  const buildMessages = () => [
    {
      role: "system" as const,
      content: buildSystemPrompt({
        channelTitle: channel.title,
        channelKind: channel.kind,
        subject: channel.subject,
        nowColombo: now.label,
      }),
    },
    {
      role: "user" as const,
      content: buildUserPrompt({
        text: msg.text,
        hasMedia: Boolean(msg.has_media),
        mediaName: msg.media_name,
        mediaKind: msg.media_kind,
        attachmentExcerpt,
        isForwarded: Boolean(msg.is_forwarded),
        forwardFrom: msg.forward_from,
        messageDate: `${toColomboDate(msg.date)} ${toColomboTime(msg.date)}`,
        hints,
      }),
    },
  ];

  const call = async (maxTokens: number, disableReasoning: boolean) =>
    completeWithPool(choice, {
      messages: buildMessages(),
      temperature: settings.temperature,
      maxTokens,
      model: settings.model || provider.defaultModel || undefined,
      jsonMode: true,
      disableReasoning,
      timeoutMs: requestTimeout,
    });

  // One attempt with reasoning suppressed (much faster), then one plain retry.
  // Anything beyond that is a rate limit or an outage: let the queue defer it
  // rather than holding the run open on a shared free tier.
  let res: Awaited<ReturnType<typeof call>>;
  try {
    res = await call(settings.maxTokens, true);
  } catch (firstErr) {
    if (/\b429\b|rate limit/i.test((firstErr as Error).message)) throw firstErr;
    res = await call(settings.maxTokens, false);
  }

  let extraction: Extraction;
  try {
    extraction = parseExtraction(res.text);
  } catch (err) {
    if (!res.truncated) throw err;
    // Ran out of room mid-JSON: give it a much bigger budget once.
    res = await call(Math.max(settings.maxTokens * 3, 6000), false);
    extraction = parseExtraction(res.text);
  }

  saveAnalysis(msg.id, extraction, provider.id, res.model);
  // Only verify what actually carries a schedule: a "reaction" or "chat" verdict
  // has nothing to disagree about, and verifying it would double the cost of the
  // noisiest half of a channel for no benefit.
  if (
    extraction.event_date != null ||
    extraction.event_time != null ||
    extraction.kind === "postponement" ||
    extraction.kind === "cancellation" ||
    extraction.kind === "time_change"
  ) {
    await tryCrossCheck(msg, extraction, provider.id, res.model, hints);
  }
  return {
    messageId: msg.id,
    ok: true,
    usedAi: true,
    kind: extraction.kind,
    latencyMs: res.latencyMs,
  };
}

/**
 * Read the same message a second time with a different model and compare.
 * Never throws: a verification problem must not undo a good extraction.
 */
async function tryCrossCheck(
  msg: AnalyzableMessage,
  extraction: Extraction,
  providerId: string,
  model: string,
  hints: RuleHints,
): Promise<void> {
  try {
    const { crossCheck } = await import("./crosscheck.js");
    await crossCheck(msg.id, extraction, providerId, model, {
      channelTitle: msg.channel.title,
      channelKind: msg.channel.kind,
      subject: msg.channel.subject,
      text: msg.text,
      date: msg.date,
      hints,
    });
  } catch {
    /* verification is best-effort */
  }
}

export function pendingMessageCount(): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages m
       LEFT JOIN analysis a ON a.message_id = m.id
       WHERE a.message_id IS NULL OR a.provider = 'error'`,
    )
    .get() as { n: number };
  return row.n;
}

/** A message row joined with its channel columns, as returned by the queries. */
export interface RawMessageRow extends Omit<Message, "links"> {
  username: string;
  channel_title: string;
  subject: Subject;
  accent: string;
  channel_kind: string;
  a_kind: string | null;
  links: Array<{ url: string; kind: string; host: string }>;
}

/**
 * Messages that have never been analysed, plus ones whose last attempt failed.
 * Shared free tiers return 429s and truncated replies, so a failure is a
 * "try again later", not a permanent verdict.
 */
export function unanalyzedMessages(limit: number, priorityFirst = true): RawMessageRow[] {
  // Oldest messages first: the backlog is history, and history sets the baseline
  // schedule that later postponements amend. Retries jump to the front.
  const order = priorityFirst
    ? "CASE WHEN a.provider = 'error' THEN 0 ELSE 1 END, m.date ASC"
    : "m.date DESC";
  return db
    .prepare(
      `SELECT m.*,
              c.username, c.title AS channel_title, c.subject, c.accent, c.kind AS channel_kind,
              a.kind AS a_kind
       FROM messages m
       JOIN channels c ON c.id = m.channel_id
       LEFT JOIN analysis a ON a.message_id = m.id
       WHERE a.message_id IS NULL OR a.provider = 'error'
       ORDER BY ${order}
       LIMIT ?`,
    )
    .all(limit) as RawMessageRow[];
}

export type { Analysis, Extraction };
