import { db, getSetting } from "../db/index.js";
import { resolveProvider } from "../ai/rotate.js";
import { pendingMessageCount } from "../ai/engine.js";
import type { Channel } from "../../../../shared/types.js";
import {
  channelsNeedingSync,
  getChannelByUsername,
  listChannels,
  markImportantMessages,
  storeMessages,
} from "../db/store.js";
import { webPreviewAvailable } from "../db/index.js";
import { PreviewDisabledError, scrapePublicPreview } from "../telegram/webpreview.js";
import { backfillDepth } from "../ai/prefilter.js";
import { advise } from "../ai/advice.js";
import {
  fetchChannelMessages,
  getClient,
  isAuthorized,
  MTP_CONFIGURED,
  PHONE_NUMBER_REQUIRED,
} from "../telegram/mtproto.js";
import { EventEmitter } from "node:events";

export type SyncMode = "mtproto" | "webpreview" | "mixed" | "none";

export interface SyncProgress {
  running: boolean;
  phase: string;
  channel: string | null;
  fetched: number;
  inserted: number;
  analyzed: number;
  errors: string[];
  startedAt: number | null;
  finishedAt: number | null;
}

export const progress: SyncProgress = {
  running: false,
  phase: "idle",
  channel: null,
  fetched: 0,
  inserted: 0,
  analyzed: 0,
  errors: [],
  startedAt: null,
  finishedAt: null,
};

const listeners = new EventEmitter();
export function onProgress(fn: (p: SyncProgress) => void): () => void {
  listeners.on("progress", fn);
  return () => listeners.off("progress", fn);
}
function emit(): void {
  listeners.emit("progress", { ...progress });
}

function logSync(
  channelId: number | null,
  started: number,
  ok: boolean,
  fetched: number,
  inserted: number,
  mode: string,
  error?: string,
): void {  db.prepare(
    `INSERT INTO sync_log (channel_id, started_at, finished_at, ok, fetched, inserted, mode, error)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(channelId, started, Date.now(), ok ? 1 : 0, fetched, inserted, mode, error ?? null);
}

let modeCache: SyncMode = "none";
let authorizedMtp = false;

/** Recompute and cache which ingestion paths are currently usable. */
export async function refreshMode(): Promise<SyncMode> {
  authorizedMtp = MTP_CONFIGURED ? await isAuthorized() : false;
  const anyWeb = listChannels().some((c) => c.enabled && webPreviewAvailable(c.username));
  modeCache = authorizedMtp && anyWeb ? "mixed" : authorizedMtp ? "mtproto" : anyWeb ? "webpreview" : "none";
  return modeCache;
}

export function currentMode(): SyncMode {
  return modeCache;
}

/** True when a Telegram account session can read every channel. */
export function mtpUsable(): boolean {
  return authorizedMtp;
}

export interface SyncOptions {
  /** Re-pull this many days of history for each channel. Default: incremental. */
  backfillDays?: number;
  /** Run the AI pass over newly inserted messages. Default true. */
  analyze?: boolean;
  /** Only sync this channel username. */
  only?: string;
  signal?: AbortSignal;
}

/**
 * Pull every enabled channel, then analyse whatever is new.
 * Uses the authenticated MTProto session when available and falls back to the
 * public web preview per channel otherwise, so a missing login never blocks the
 * channels that do expose one.
 */
export async function syncAll(opts: SyncOptions = {}): Promise<SyncProgress> {
  if (progress.running) return { ...progress };
  progress.running = true;
  progress.startedAt = Date.now();
  progress.finishedAt = null;
  progress.fetched = 0;
  progress.inserted = 0;
  progress.analyzed = 0;
  progress.errors = [];
  progress.phase = "fetching";
  emit();

  const channels = channelsNeedingSync().filter(
    (c) => (!opts.only || c.username.toLowerCase() === opts.only.toLowerCase()) && c.enabled,
  );

  const useMtp = MTP_CONFIGURED && (await isAuthorized());
  if (useMtp) {
    try {
      await getClient();
    } catch (err) {
      const name = (err as Error).message;
      if (name === PHONE_NUMBER_REQUIRED) {
        progress.errors.push("Telegram session expired — reconnect your account in Settings.");
      }
    }
  }

  for (const channel of channels) {
    if (opts.signal?.aborted) break;
    progress.channel = channel.username;
    emit();

    const started = Date.now();
    const cold = channel.last_scanned_id === 0;
    const days = opts.backfillDays ?? (cold ? 30 : 0);
    let fetched = 0;
    let inserted = 0;

    try {
      const canPreview = webPreviewAvailable(channel.username);
      let messages: Awaited<ReturnType<typeof fetchChannelMessages>> | null = null;
      let mode: "mtproto" | "webpreview" = "webpreview";

      if (useMtp) {
        try {
          messages = await fetchChannelMessages(channel.username, {
            limit: cold ? Math.min(600, backfillDepth(days) * 20) : 120,
            offsetId: cold ? 0 : channel.last_scanned_id,
          });
          mode = "mtproto";
        } catch (err) {
          progress.errors.push(`@${channel.username} MTProto failed: ${(err as Error).message}`);
        }
      }

      if (!messages) {
        if (!canPreview) {
          progress.errors.push(
            `@${channel.username} needs a Telegram account login (no public web preview).`,
          );
          logSync(channel.id, started, false, 0, 0, "skipped", "no preview, no session");
          continue;
        }
        mode = "webpreview";
        const page = await scrapePublicPreview(channel.username, {
          pages: cold ? backfillDepth(days) : 1,
          signal: opts.signal,
        });
        messages = page.messages;
        if (page.channelTitle) {
          db.prepare("UPDATE channels SET title = ?, member_count = ? WHERE id = ?").run(
            page.channelTitle,
            page.memberCount,
            channel.id,
          );
        }
      }

      const res = storeMessages(channel.id, mode, messages);
      fetched = res.fetched;
      inserted = res.inserted;
      progress.fetched += fetched;
      progress.inserted += inserted;
      logSync(channel.id, started, true, fetched, inserted, mode);
    } catch (err) {
      if (err instanceof PreviewDisabledError) {
        progress.errors.push(err.message);
        logSync(channel.id, started, false, 0, 0, "webpreview", err.message);
      } else {
        progress.errors.push(`@${channel.username}: ${(err as Error).message}`);
        logSync(channel.id, started, false, 0, 0, "?", (err as Error).message);
      }
    }
    emit();
  }

  markImportantMessages();

  if (opts.analyze !== false) {
    progress.phase = "analyzing";
    progress.channel = null;
    emit();
    const n = await runAnalysisQueue((count) => {
      progress.analyzed = count;
      emit();
    });
    progress.phase = n.processed > 0 ? "projecting" : "idle";
    emit();
  }

  progress.running = false;
  progress.channel = null;
  progress.phase = "idle";
  progress.finishedAt = Date.now();
  emit();
  return { ...progress };
}

/* ---------------------------------------------------------------- analysis */

let analyzing = false;

export interface QueueResult {
  processed: number;
  failed: number;
  rateLimited: number;
  usedAi: number;
  remaining: number;
  lastError: string | null;
  advice: { headline: string; detail: string; action: string; severity: string } | null;
}

let lastAdvice: QueueResult["advice"] = null;
let lastAdviceAt = 0;
/** Advice older than this is not worth showing: the situation has moved on. */
const ADVICE_TTL_MS = 10 * 60 * 1000;

/**
 * Prefer the in-memory advice from this run, but fall back to the most recent
 * stored failure so a restart does not lose it. Advice also expires: an old
 * rate-limit message that is still on screen hours later is worse than no
 * message, because it describes a problem that has already been handled.
 */
export function getLastAdvice(): QueueResult["advice"] {
  if (lastAdvice && Date.now() - lastAdviceAt < ADVICE_TTL_MS) return lastAdvice;

  const row = db
    .prepare(
      `SELECT detail, analyzed_at FROM analysis
       WHERE provider = 'error' AND detail LIKE 'Analysis failed:%'
       ORDER BY analyzed_at DESC LIMIT 1`,
    )
    .get() as { detail: string; analyzed_at: number } | undefined;

  if (!row) return null;
  if (Date.now() - row.analyzed_at > ADVICE_TTL_MS) {
    // Keep it in the app log rather than on screen: still useful to have, but
    // no longer something to interrupt the student for.
    console.log(`[theTodo:engine] dropping stale advice: ${row.detail.slice(0, 140)}`);
    return null;
  }
  return advise(row.detail.replace(/^Analysis failed:\s*/, ""));
}

export async function runAnalysisQueue(
  onTick?: (processed: number) => void,
  limit = 100000,
): Promise<QueueResult> {
  const { analyzeMessage, aiSettings, unanalyzedMessages, providerReady } = await import(
    "../ai/engine.js"
  );
  if (analyzing) {
    return { processed: 0, failed: 0, rateLimited: 0, usedAi: 0, remaining: -1, lastError: null, advice: null };
  }
  analyzing = true;

  const settings = aiSettings();
  const ready = providerReady(settings);
  // A run that is about to start with a working provider clears the previous
  // warning, so a rate limit that has since cleared does not stay on screen.
  if (ready) {
    lastAdvice = null;
    lastAdviceAt = 0;
  }
  let processed = 0;
  let failed = 0;
  let rateLimited = 0;
  let usedAi = 0;
  let lastError: string | null = null;
  cancelRequested = false;

  /**
   * Circuit breaker.
   *
   * When every key is cooling down, each message fails immediately and
   * identically. Without a stop, one throttled key quietly marked the entire
   * backlog as failed in a couple of minutes, which looks exactly like success
   * right up until you look. A run of identical failures means the connection
   * is not going to recover on its own, so the run ends with a clear reason.
   */
  const MAX_CONSECUTIVE = 8;
  let consecutiveSame = 0;
  let lastSignature = "";
  let breakerReason: string | null = null;

  // Know the size of the job up front, so progress is a real denominator rather
  // than a bar that sits still because the total is unknown.
  const planned = Math.min(limit, pendingMessageCount());
  resetAnalysisProgress(planned);

  /** One line of "what it just did", so the run is legible while it happens. */
  const headlineOf = (msg: { channel?: { username?: string } }, kind: string | null): string | null => {
    const who = msg.channel?.username ? `@${msg.channel.username}` : "a message";
    return kind ? `${who}: ${kind.replace(/_/g, " ")}` : who;
  };

  const recordFailure = (messageId: number, err: unknown, msg?: unknown) => {
    const message = (err as Error)?.message ?? String(err);
    lastError = message;
    lastAdvice = advise(message);
    lastAdviceAt = Date.now();
    if (/\b429\b|rate limit|quota/i.test(message)) rateLimited++;
    else failed++;

    // Trip the breaker on a run of the same failure.
    const signature = message.slice(0, 80);
    consecutiveSame = signature === lastSignature ? consecutiveSame + 1 : 1;
    lastSignature = signature;
    if (consecutiveSame >= MAX_CONSECUTIVE && !breakerReason) {
      breakerReason = /rate limit|cooling down/i.test(message)
        ? `Stopped after ${consecutiveSame} attempts: the connection is rate limited. Its keys are cooling down, so the rest of the backlog is untouched. Press Analyse again later, or switch to another connection.`
        : `Stopped after ${consecutiveSame} attempts with the same error: ${message.slice(0, 140)}`;
      analysisProgress.problem = breakerReason;
      emit();
    }
    // A failure is retryable, not final: the next pass picks it up again.
    db.prepare(
      `INSERT INTO analysis (message_id, provider, model, prompt_version, kind, headline, detail,
         urgency, confidence, raw_json, analyzed_at)
       VALUES (?, 'error', ?, 'v1', 'irrelevant', '', ?, 'low', 0, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET
         provider = 'error', model = excluded.model, detail = excluded.detail,
         raw_json = excluded.raw_json, analyzed_at = excluded.analyzed_at`,
    ).run(
      messageId,
      settings.model || settings.provider,
      `Analysis failed: ${message}`,
      JSON.stringify({ error: message }),
      Date.now(),
    );
    processed++;
    tickAnalysis(false, (msg as { channel?: { username?: string } })?.channel?.username ? `@${(msg as any).channel.username} failed` : null);
    onTick?.(processed);
  };

  try {
    const batchSize = ready ? Math.max(1, Math.min(settings.batchSize, 25)) : 200;
    // A slow provider is better served by more parallel requests than by a
    // bigger batch size; workers and batch size are independent knobs.
    const workers = !ready ? 1 : Math.max(1, Math.min(settings.concurrency, 8));

    while (processed < limit) {
      // A tripped breaker ends the run outright. Without this the workers just
      // return without doing any work, and the loop spins forever.
      if (cancelRequested || breakerReason) break;
      const batch = unanalyzedMessages(batchSize);
      if (batch.length === 0) break;

      // A few workers in parallel: a slow provider then costs wall-clock time
      // rather than serialising the whole backfill.
      const queue = [...batch];
      const runWorker = async () => {
        while (queue.length > 0 && processed < limit) {
          if (cancelRequested || breakerReason) return;
          const row = queue.shift();
          if (!row) return;
          const msg = {
            ...row,
            channel: {
              username: row.username,
              title: row.channel_title,
              subject: row.subject,
              accent: row.accent,
              kind: row.channel_kind,
            } as Channel,
          };
          try {
            const r = await analyzeMessage(msg, settings);
            if (r.usedAi) usedAi++;
            processed++;
            // A success clears the run of failures, so one bad message in the
            // middle of a long list does not trip the breaker.
            consecutiveSame = 0;
            lastSignature = "";
            tickAnalysis(true, headlineOf(msg, r.kind));
            onTick?.(processed);
          } catch (err) {
            recordFailure(row.id, err, msg);
          }
        }
      };
      await Promise.all(Array.from({ length: workers }, runWorker));
    }
  } finally {
    analyzing = false;
  }

  const { projectAll } = await import("./project.js");
  const { rebuildLinks } = await import("../db/store.js");
  rebuildLinks();
  projectAll();

  const okCount = analysisProgress.ok;
  const remaining = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages m
         LEFT JOIN analysis a ON a.message_id = m.id
         WHERE a.message_id IS NULL OR a.provider = 'error'`,
      )
      .get() as { n: number }
  ).n;

  finishAnalysis(
    breakerReason ??
      (cancelRequested
        ? "Stopped at your request. Nothing is lost: run Analyse again to carry on."
        : processed > 0 && okCount === 0
          ? "Nothing could be read this time. Check the connection and try again."
          : null),
  );

  return {
    processed,
    failed,
    rateLimited,
    usedAi,
    remaining,
    lastError,
    // A run that got through without a single failure means the previous
    // problem is gone, so the banner is cleared rather than left to expire.
    advice: lastError ? advise(lastError) : null,
  };
}

/* ------------------------------------------------------------- analysis UI */

export interface AnalysisProgress {
  running: boolean;
  /** Messages to process in this run. */
  total: number;
  processed: number;
  ok: number;
  failed: number;
  rateLimited: number;
  remaining: number;
  /** Messages per minute, averaged over the run so far. */
  perMinute: number;
  /** Rough seconds left, or null when there is not enough data yet. */
  etaSeconds: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  /** Which connection and model is doing the work. */
  connection: string | null;
  model: string | null;
  /** Set when the run ended with a problem worth explaining. */
  problem: string | null;
  lastMessage: string | null;
}

export const analysisProgress: AnalysisProgress = {
  running: false,
  total: 0,
  processed: 0,
  ok: 0,
  failed: 0,
  rateLimited: 0,
  remaining: 0,
  perMinute: 0,
  etaSeconds: null,
  startedAt: null,
  finishedAt: null,
  connection: null,
  model: null,
  problem: null,
  lastMessage: null,
};

function resetAnalysisProgress(total: number): void {
  const a = analysisProgress;
  a.running = true;
  a.total = total;
  a.processed = 0;
  a.ok = 0;
  a.failed = 0;
  a.rateLimited = 0;
  a.remaining = total;
  a.perMinute = 0;
  a.etaSeconds = null;
  a.startedAt = Date.now();
  a.finishedAt = null;
  a.problem = null;
  a.lastMessage = null;
  try {
    const choice = resolveProvider();
    a.connection = choice?.provider.label ?? null;
    a.model = (getSetting("ai.model", "") as string) || choice?.provider.defaultModel || null;
  } catch {
    a.connection = null;
    a.model = null;
  }
  emit();
}

function tickAnalysis(ok: boolean, headline: string | null): void {
  const a = analysisProgress;
  a.processed++;
  a.remaining = Math.max(0, a.total - a.processed);
  if (ok) a.ok++;
  else if (/\b429\b|rate limit|quota/i.test(headline ?? "")) a.rateLimited++;
  else a.failed++;
  a.lastMessage = headline;
  if (a.startedAt) {
    const elapsedMin = (Date.now() - a.startedAt) / 60_000;
    a.perMinute = elapsedMin > 0.02 ? Math.round(a.processed / elapsedMin) : 0;
    a.etaSeconds =
      a.perMinute > 0 ? Math.round((a.remaining / a.perMinute) * 60) : null;
  }
  emit();
}

function finishAnalysis(problem: string | null): void {
  const a = analysisProgress;
  a.running = false;
  a.finishedAt = Date.now();
  a.problem = problem;
  a.remaining = 0;
  a.etaSeconds = null;
  emit();
}

let cancelRequested = false;

/** Ask a running analysis queue to stop after the message in flight. */
export function cancelAnalysis(): { ok: boolean } {
  if (!analysisProgress.running) return { ok: false };
  cancelRequested = true;
  analysisProgress.problem = "Stopped at your request. Nothing is lost: run Analyse again to carry on.";
  emit();
  return { ok: true };
}

export function isAnalysisRunning(): boolean {
  return analysisProgress.running;
}

/* --------------------------------------------------------------- scheduler */

let timer: NodeJS.Timeout | null = null;
let lastRunAt = 0;

export function startScheduler(getMinutes: () => number, getEnabled: () => boolean): void {
  stopScheduler();
  timer = setInterval(() => {
    if (!getEnabled() || progress.running) return;
    const minutes = getMinutes();
    if (minutes <= 0) return;
    if (Date.now() - lastRunAt < minutes * 60_000) return;
    lastRunAt = Date.now();
    // Fetch only. Automatic runs never start the analysis queue: on a free tier
    // that is minutes of quiet "analyzing" with no way to tell it apart from a
    // hang, and it happens every few minutes.
    void refreshMode()
      .then(() => syncAll({ analyze: false }))
      .catch(() => undefined);
  }, 30_000);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

export { getChannelByUsername };
