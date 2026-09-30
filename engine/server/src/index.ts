import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { APP_ROOT, quietenEngine } from "./paths.js";
// Before anything else can log, so the MTProto client's startup banner does not
// end up in a log nobody is reading.
quietenEngine();

import { db, getSetting, setSetting, seedChannels, DATA_DIR } from "./db/index.js";
import type { Request, Response, NextFunction } from "express";
import type { Dashboard, Message } from "../../../shared/types.js";
import {
  aiSettings,
  colomboNow,
  providerReady,
  pendingMessageCount,
  shiftDate,
  todayColombo,
} from "./ai/engine.js";
import { getProvider, PROVIDERS } from "./ai/provider.js";
import {
  crossCheckConfig,
  crossCheckSummary,
  saveCrossCheckConfig,
  verifierOptions,
} from "./ai/crosscheck.js";
import { buildScheduleExport } from "./pipeline/export.js";
import { rankForSinhala, suggestModel } from "./ai/ranking.js";
import {
  addKey,
  adoptLegacyKey,
  availableCount,
  classify,
  listKeys,
  removeKey,
  report,
  revive,
  totalCount,
  updateKey,
} from "./ai/keypool.js";
import {
  addCustomProvider,
  fetchModels,
  getCustomProvider,
  listCustomProviders,
  poolKey,
  removeCustomProvider,
  updateCustomProvider,
} from "./ai/custom.js";
import { completeWithPool, modelsFor, resolveProviderById } from "./ai/rotate.js";
import {
  activateConnection,
  describeConnectionFresh,
  listConnections,
  setConnectionModel,
} from "./ai/connections.js";
import { catalogueFor, warmCatalogues } from "./ai/catalogue.js";
import { cancelAnalysis, isAnalysisRunning, analysisProgress } from "./pipeline/sync.js";

/** Never echo a whole key back to the browser. */
function maskKey(k: string): string {
  const s = k.trim();
  if (s.length <= 10) return s.slice(0, 3) + "…";
  return `${s.slice(0, 5)}…${s.slice(-4)}`;
}

/**
 * When the first key for a provider appears, choose the best free model that
 * provider actually offers for Sinhala, so nothing has to be guessed later.
 */
async function autoSelectModel(provider: string): Promise<string | null> {
  try {
    // Only choose while there is exactly one key, so adding a second key does
    // not silently change a model the student picked on purpose.
    if (totalCount(provider) !== 1) return null;
    if (provider === "kiloFree") return null; // routes itself
    if (getSetting("ai.model", "")) return null;
    if (getSetting("ai.provider", "gemini") !== provider) return null;
    const models = await modelsFor(provider);
    const best = suggestModel(models);
    if (!best) return null;
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('ai.model',?)").run(
      JSON.stringify(best.id),
    );
    return best.id;
  } catch {
    return null;
  }
}
import {
  getChannel,
  listChannels,
  markImportantMessages,
  rebuildLinks,
} from "./db/store.js";
import {
  currentMode,
  getLastAdvice,
  onProgress,
  progress,
  refreshMode,
  runAnalysisQueue,
  startScheduler,
  stopScheduler,
  syncAll,
} from "./pipeline/sync.js";
import { getEvent, listEvents, projectAll } from "./pipeline/project.js";
import {
  disconnect,
  downloadMedia,
  hasStoredSession,
  isAuthorized,
  loginState,
  logout,
  me,
  MTP_CONFIGURED,
  startLogin,
  submitCode,
  submitPassword,
} from "./telegram/mtproto.js";

const PORT = Number(process.env.PORT ?? 5178);

// node:sqlite is stable in practice but still flagged experimental by Node, and
// the warning would otherwise be the first thing a user sees.
process.removeAllListeners("warning");
seedChannels();
// Move a key saved before the pool existed into the pool, so an existing
// install gains rotation without the student re-entering anything. Runs once.
adoptLegacyKey();
// Fetch any missing model catalogue in the background, so opening Settings is
// never what pays for a network round trip.
warmCatalogues();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* ------------------------------------------------------------------ helpers */

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function publicSettings() {
  const s = aiSettings();
  return {
    provider: s.provider,
    hasApiKey: Boolean(s.apiKey),
    model: s.model,
    batchSize: s.batchSize,
    maxTokens: s.maxTokens,
    temperature: s.temperature,
    useLayaTriage: s.useLayaTriage,
    layaEndpoint: s.layaEndpoint,
    autoSyncEnabled: s.autoSyncEnabled,
    autoSyncMinutes: s.autoSyncMinutes,
  };
}

const MESSAGE_SELECT = `
  SELECT m.*, c.username, c.title AS channel_title, c.subject, c.accent, c.kind AS channel_kind,
         a.kind AS a_kind, a.class_type AS a_class_type, a.subject AS a_subject,
         a.headline AS a_headline, a.detail AS a_detail, a.action AS a_action,
         a.urgency AS a_urgency, a.status_change AS a_status_change,
         a.event_date AS a_event_date, a.event_time AS a_event_time, a.confidence AS a_confidence,
         a.provider AS a_provider, a.model AS a_model, a.analyzed_at AS a_analyzed_at
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  LEFT JOIN analysis a ON a.message_id = m.id
`;

/* -------------------------------------------------------------------- setup */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "TheToDo", now: colomboNow() });
});

app.get("/api/state", async (_req, res) => {
  const s = aiSettings();
  await refreshMode();
  const account = MTP_CONFIGURED && hasStoredSession() ? await me().catch(() => null) : null;
  res.json({
    mode: currentMode(),
    authenticated: Boolean(account),
    account,
    mtprotoConfigured: MTP_CONFIGURED,
    sessionStored: hasStoredSession(),
    providerReady: providerReady(s),
    providers: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      defaultModel: p.defaultModel,
      requiresKey: p.requiresKey,
      note: "note" in p ? String((p as { note?: string }).note ?? "") : "",
    })),
    settings: publicSettings(),
    channels: listChannels(),
    progress,
    pendingAnalysis: pendingMessageCount(),
    advice: getLastAdvice(),
    aiStats: db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM analysis WHERE provider NOT IN ('rules','laya','error')) AS aiOk,
           (SELECT COUNT(*) FROM analysis WHERE provider = 'error') AS aiFailed,
           (SELECT COUNT(*) FROM analysis WHERE provider NOT IN ('rules','laya','error') AND confidence < 0.4) AS lowConfidence`,
      )
      .get(),
    now: colomboNow(),
  });
});

/* ----------------------------------------------------------------- channels */

app.get("/api/channels", (_req, res) => {
  res.json(listChannels());
});

/** Per-channel coverage, so the Channels tab can show what has been read. */
app.get("/api/channel-stats", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id,
              (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS messages,
              (SELECT COUNT(*) FROM messages m JOIN analysis a ON a.message_id = m.id
                WHERE m.channel_id = c.id AND a.provider = 'rules') AS rules_only,
              (SELECT COUNT(*) FROM messages m JOIN analysis a ON a.message_id = m.id
                WHERE m.channel_id = c.id AND a.provider NOT IN ('rules','error')) AS understood,
              (SELECT COUNT(*) FROM messages m JOIN analysis a ON a.message_id = m.id
                WHERE m.channel_id = c.id AND a.provider = 'error') AS failed,
              (SELECT MIN(m.date) FROM messages m WHERE m.channel_id = c.id) AS oldest,
              (SELECT MAX(m.date) FROM messages m WHERE m.channel_id = c.id) AS newest,
              (SELECT COUNT(DISTINCT es.event_id) FROM event_sources es
                JOIN messages m ON m.id = es.message_id WHERE m.channel_id = c.id) AS events,
              (SELECT COUNT(*) FROM links l JOIN messages m ON m.id = l.message_id
                WHERE m.channel_id = c.id) AS links
       FROM channels c ORDER BY c.subject, c.kind`,
    )
    .all() as any[];
  const out: Record<number, any> = {};
  for (const r of rows) {
    out[r.id] = {
      id: r.id,
      messages: r.messages ?? 0,
      understood: r.understood ?? 0,
      rulesOnly: r.rules_only ?? 0,
      failed: r.failed ?? 0,
      pending: Math.max(0, (r.messages ?? 0) - (r.understood ?? 0) - (r.failed ?? 0)),
      events: r.events ?? 0,
      links: r.links ?? 0,
      oldest: r.oldest ?? null,
      newest: r.newest ?? null,
    };
  }
  res.json(out);
});

app.patch("/api/channels/:id", (req, res) => {
  const id = Number(req.params.id);
  const allowed = ["enabled", "title", "subject", "accent", "kind"] as const;
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = key === "enabled" ? (asBool(req.body[key]) ? 1 : 0) : req.body[key];
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nothing to update" });
  db.prepare(`UPDATE channels SET ${sets.join(", ")} WHERE id = @id`).run(params);
  res.json(getChannel(id));
});

/* ----------------------------------------------------------------- messages */

app.get("/api/messages", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const channelId = req.query.channelId ? Number(req.query.channelId) : null;
  const kind = String(req.query.kind ?? "all");
  const classType = String(req.query.classType ?? "all");
  const subject = String(req.query.subject ?? "all");
  const importantOnly = asBool(req.query.importantOnly);
  const unanalyzedOnly = asBool(req.query.unanalyzedOnly);
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const offset = Number(req.query.offset ?? 0);

  const where: string[] = [];
  // node:sqlite rejects named parameters a statement does not reference, so the
  // filters and the pagination are kept apart: the COUNT below reuses the
  // filters and must not be handed @limit / @offset.
  const params: Record<string, unknown> = {};
  const page: Record<string, unknown> = { limit, offset };

  if (q) {
    where.push("(m.text LIKE @q OR a.headline LIKE @q OR a.detail LIKE @q OR a.action LIKE @q)");
    params.q = `%${q}%`;
  }
  if (channelId) {
    where.push("m.channel_id = @channelId");
    params.channelId = channelId;
  }
  if (kind !== "all") {
    where.push("a.kind = @kind");
    params.kind = kind;
  }
  if (classType !== "all") {
    where.push("a.class_type = @classType");
    params.classType = classType;
  }
  if (subject !== "all") {
    where.push("c.subject = @subject");
    params.subject = subject;
  }
  if (importantOnly) where.push("m.is_important = 1");
  if (unanalyzedOnly) where.push("(a.message_id IS NULL OR a.provider = 'error')");
  if (from) {
    where.push("m.date >= @fromTs");
    params.fromTs = new Date(`${from}T00:00:00+05:30`).getTime() / 1000;
  }
  if (to) {
    where.push("m.date <= @toTs");
    params.toTs = new Date(`${to}T23:59:59+05:30`).getTime() / 1000;
  }

  const rows = db
    .prepare(
      `${MESSAGE_SELECT}
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY m.date DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, ...page }) as any[];

  const ids = rows.map((r) => r.id);
  const links = ids.length
    ? (db
        .prepare(`SELECT * FROM links WHERE message_id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as any[])
    : [];

  const messages: Message[] = rows.map((r) => ({
    id: r.id,
    channel_id: r.channel_id,
    msg_id: r.msg_id,
    date: r.date,
    edit_date: r.edit_date,
    text: r.text,
    raw_text: r.raw_text,
    has_media: r.has_media,
    media_kind: r.media_kind,
    media_name: r.media_name,
    media_mime: r.media_mime,
    media_size: r.media_size,
    media_ref: r.media_ref,
    is_forwarded: r.is_forwarded,
    forward_from: r.forward_from,
    views: r.views,
    has_reply: r.has_reply,
    reply_to_id: r.reply_to_id,
    grouped_id: r.grouped_id,
    source: r.source,
    is_important: r.is_important,
    is_read: r.is_read,
    created_at: r.created_at,
    channel: {
      username: r.username,
      title: r.channel_title,
      subject: r.subject,
      accent: r.accent,
      kind: r.channel_kind,
    },
    analysis:
      r.a_kind && r.a_provider !== "error"
        ? {
            message_id: r.id,
            provider: r.a_provider,
            model: r.a_model,
            prompt_version: "v1",
            kind: r.a_kind,
            class_type: r.a_class_type,
            subject: r.a_subject,
            headline: r.a_headline,
            detail: r.a_detail,
            action: r.a_action,
            urgency: r.a_urgency,
            status_change: r.a_status_change,
            event_date: r.a_event_date,
            event_time: r.a_event_time,
            event_end_time: null,
            confidence: r.a_confidence,
            raw_json: null,
            analyzed_at: r.a_analyzed_at,
          }
        : null,
    // A failed attempt is not an understanding. Keep the reason so the UI can
    // say "rate limited, will retry" instead of showing an error string where a
    // summary belongs.
    analysisError: r.a_provider === "error" ? r.a_detail : null,
    links: links.filter((l) => l.message_id === r.id),
  }));

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages m
         JOIN channels c ON c.id = m.channel_id
         LEFT JOIN analysis a ON a.message_id = m.id
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
      )
      .get(params) as { n: number }
  ).n;

  res.json({ messages, total, limit, offset });
});

app.post("/api/messages/:id/important", (req, res) => {
  db.prepare("UPDATE messages SET is_important = ? WHERE id = ?").run(
    asBool(req.body.important) ? 1 : 0,
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.post("/api/messages/:id/read", (req, res) => {
  db.prepare("UPDATE messages SET is_read = ? WHERE id = ?").run(
    asBool(req.body.read) ? 1 : 0,
    Number(req.params.id),
  );
  res.json({ ok: true });
});

app.post("/api/messages/:id/reanalyze", async (req, res) => {
  const row = db
    .prepare(
      `SELECT m.*, c.username, c.title AS channel_title, c.subject, c.accent, c.kind AS channel_kind
       FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = ?`,
    )
    .get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: "not found" });

  db.prepare("DELETE FROM analysis WHERE message_id = ?").run(row.id);
  db.prepare("DELETE FROM links WHERE message_id = ?").run(row.id);
  const { extractLinks } = await import("./telegram/links.js");
  for (const l of extractLinks(row.text)) {
    db.prepare(
      "INSERT OR IGNORE INTO links (message_id, url, kind, label, host) VALUES (?,?,?,?,?)",
    ).run(row.id, l.url, l.kind, l.kind, l.host);
  }

  const { analyzeMessage, aiSettings: get } = await import("./ai/engine.js");
  const result = await analyzeMessage(
    { ...row, channel: row } as never,
    get(),
  ).catch((e) => ({ ok: false, error: (e as Error).message, messageId: row.id, usedAi: false, kind: null }));
  projectAll();
  res.json(result);
});

app.get("/api/messages/:id/media", async (req, res) => {
  const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: "not found" });
  const channel = getChannel(row.channel_id);
  if (!channel) return res.status(404).json({ error: "channel missing" });
  try {
    const local = await downloadMedia(channel.username, row.msg_id);
    if (!local) return res.status(404).json({ error: "no media on this message" });
    res.sendFile(local);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/* ------------------------------------------------------------------- events */

app.get("/api/events", (req, res) => {
  res.json(
    listEvents({
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      subject: req.query.subject ? String(req.query.subject) : undefined,
      classType: req.query.classType ? String(req.query.classType) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  );
});

app.get("/api/events/:id", (req, res) => {
  const ev = getEvent(Number(req.params.id));
  if (!ev) return res.status(404).json({ error: "not found" });
  res.json(ev);
});

app.patch("/api/events/:id", (req, res) => {
  const id = Number(req.params.id);
  const allowed = [
    "title",
    "event_date",
    "event_time",
    "event_end_time",
    "status",
    "class_type",
    "urgency",
    "note",
    "action",
  ] as const;
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, now: Date.now() };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = req.body[key];
    }
  }
  if (!sets.length) return res.status(400).json({ error: "nothing to update" });
  sets.push("updated_at = @now");
  db.prepare(`UPDATE events SET ${sets.join(", ")} WHERE id = @id`).run(params);
  res.json(getEvent(id));
});

app.delete("/api/events/:id", (req, res) => {
  db.prepare("DELETE FROM events WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

/* -------------------------------------------------------------------- tasks */

app.get("/api/tasks", (req, res) => {
  const showDone = asBool(req.query.done);
  const rows = db
    .prepare(
      `SELECT * FROM tasks ${showDone ? "" : "WHERE done = 0"}
       ORDER BY done ASC, COALESCE(due_date,'9999-12-31') ASC, created_at DESC LIMIT 500`,
    )
    .all() as any[];
  res.json(rows);
});

app.patch("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (req.body.done !== undefined) {
    db.prepare("UPDATE tasks SET done = ? WHERE id = ?").run(asBool(req.body.done) ? 1 : 0, id);
  }
  for (const key of ["title", "note", "due_date", "due_time"] as const) {
    if (req.body[key] !== undefined) {
      db.prepare(`UPDATE tasks SET ${key} = @${key} WHERE id = @id`).run({ [key]: req.body[key], id });
    }
  }
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id));
});

/* -------------------------------------------------------------------- links */

app.get("/api/links", (req, res) => {
  const kind = String(req.query.kind ?? "all");
  const limit = Math.min(Number(req.query.limit ?? 300), 1000);
  const rows = db
    .prepare(
      `SELECT l.*, m.date, m.msg_id, c.username, c.title AS channel_title, c.subject, c.accent
       FROM links l
       JOIN messages m ON m.id = l.message_id
       JOIN channels c ON c.id = m.channel_id
       ${kind !== "all" ? "WHERE l.kind = @kind" : ""}
       ORDER BY m.date DESC LIMIT @limit`,
    )
    .all({ kind, limit }) as any[];
  res.json(rows);
});

/* --------------------------------------------------------------- dashboard */

app.get("/api/dashboard", (_req, res) => {
  const today = todayColombo();
  const tomorrow = shiftDate(today, 1);

  const openTasks = db
    .prepare(
      `SELECT * FROM tasks WHERE done = 0
       ORDER BY COALESCE(due_date,'9999-12-31') ASC, created_at DESC LIMIT 60`,
    )
    .all() as any[];

  const recentImportant = db
    .prepare(`${MESSAGE_SELECT} WHERE m.is_important = 1 ORDER BY m.date DESC LIMIT 25`)
    .all() as any[];

  const stats: Dashboard["stats"] = {
    messages: (db.prepare("SELECT COUNT(*) n FROM messages").get() as any).n,
    analyzed: (db.prepare("SELECT COUNT(*) n FROM analysis").get() as any).n,
    // "Understood" means the model read it, everywhere in the app. Messages only
    // sorted by rules are reported separately, because rules cannot read a class
    // time out of a Sinhala sentence and presenting them as understood is a lie.
    understood: (
      db
        .prepare("SELECT COUNT(*) n FROM analysis WHERE provider NOT IN ('rules','laya','error')")
        .get() as any
    ).n,
    rulesOnly: (
      db.prepare("SELECT COUNT(*) n FROM analysis WHERE provider = 'rules'").get() as any
    ).n,
    events: (db.prepare("SELECT COUNT(*) n FROM events").get() as any).n,
    links: (db.prepare("SELECT COUNT(*) n FROM links").get() as any).n,
    unanalyzed: pendingMessageCount(),
    lastSync: (db.prepare("SELECT MAX(last_sync_at) AS t FROM channels").get() as any).t,
    // Anything not read by the model: rules-only rows, failed attempts, and
    // messages not yet attempted.
    awaitingAi: Math.max(
      0,
      (db.prepare("SELECT COUNT(*) n FROM messages").get() as any).n -
        (db
          .prepare("SELECT COUNT(*) n FROM analysis WHERE provider NOT IN ('rules','laya','error')")
          .get() as any).n,
    ),
  };

  const payload: Dashboard = {
    today: listEvents({ from: today, to: today, limit: 60 }),
    tomorrow: listEvents({ from: tomorrow, to: tomorrow, limit: 60 }),
    upcoming: listEvents({ from: shiftDate(today, 2), limit: 120 }),
    openTasks,
    recentImportant: recentImportant.map((r) => ({
      id: r.id,
      channel_id: r.channel_id,
      msg_id: r.msg_id,
      date: r.date,
      edit_date: r.edit_date,
      text: r.text,
      raw_text: r.raw_text,
      has_media: r.has_media,
      media_kind: r.media_kind,
      media_name: r.media_name,
      media_mime: r.media_mime,
      media_size: r.media_size,
      media_ref: r.media_ref,
      is_forwarded: r.is_forwarded,
      forward_from: r.forward_from,
      views: r.views,
      has_reply: r.has_reply,
      reply_to_id: r.reply_to_id,
      grouped_id: r.grouped_id,
      source: r.source,
      is_important: r.is_important,
      is_read: r.is_read,
      created_at: r.created_at,
      channel: {
        username: r.username,
        title: r.channel_title,
        subject: r.subject,
        accent: r.accent,
        kind: r.channel_kind,
      },
      analysis: r.a_kind
        ? {
            message_id: r.id,
            provider: r.a_provider,
            model: r.a_model,
            prompt_version: "v1",
            kind: r.a_kind,
            class_type: r.a_class_type,
            subject: r.a_subject,
            headline: r.a_headline,
            detail: r.a_detail,
            action: r.a_action,
            urgency: r.a_urgency,
            status_change: r.a_status_change,
            event_date: r.a_event_date,
            event_time: r.a_event_time,
            event_end_time: null,
            confidence: r.a_confidence,
            raw_json: null,
            analyzed_at: r.a_analyzed_at,
          }
        : null,
      links: [],
    })),
    stats,
  };

  res.json(payload);
});

/* -------------------------------------------------------------------- sync */

app.post("/api/sync", async (req, res) => {
  const days = req.body?.backfillDays ? Number(req.body.backfillDays) : undefined;
  const only = req.body?.only ? String(req.body.only) : undefined;
  // Syncing fetches. Understanding messages is a separate, deliberately manual
  // step: running the analysis queue on every sync left the app sitting in
  // "analyzing" for minutes on a rate-limited free tier, which looked like it
  // had frozen. The header's Analyse button does this when you want it.
  const analyze = req.body?.analyze === true;
  // Kick off in the background; the UI follows /api/state and /api/events/stream.
  void syncAll({ backfillDays: days, only, analyze }).catch(() => undefined);
  res.json({ ok: true, started: true, analyze });
});

/* ------------------------------------------------------------- hand-off */

/**
 * The whole schedule as JSON, for the planner app to read. Written to a file as
 * well as served, because a sidecar writing a file is far simpler for a Tauri
 * frontend to consume than an HTTP call into a process it does not own.
 */
app.get("/api/export", async (req, res) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 14;
    const data = buildScheduleExport(days, req.query.from ? String(req.query.from) : undefined);
    if (req.query.save === "1") {
      const file = path.join(DATA_DIR, "schedule.json");
      fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
      res.json({ ok: true, file, counts: data.counts });
      return;
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/* --------------------------------------------------------- cross-check */

app.get("/api/crosscheck", (_req, res) => {
  res.json({ config: crossCheckConfig(), options: verifierOptions(), summary: crossCheckSummary() });
});

app.patch("/api/crosscheck", (req, res) => {
  res.json(saveCrossCheckConfig({
    enabled: req.body?.enabled,
    provider: req.body?.provider,
    model: req.body?.model,
  }));
});

/** Re-verify messages that carry a date or time, using the current setting. */
app.post("/api/crosscheck/run", async (req, res) => {
  const limit = Number(req.body?.limit ?? 25);
  void runAnalysisQueue(undefined, 0).catch(() => undefined);
  res.json({ ok: true, started: true, limit });
});

/** Re-read specific messages with the model, then verify them. */
app.post("/api/crosscheck/verify", async (req, res) => {
  const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  if (!ids.length) return res.status(400).json({ error: "No message ids given." });
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`DELETE FROM analysis WHERE message_id IN (${placeholders})`).run(...ids);
  void runAnalysisQueue(undefined, 0).catch(() => undefined);
  res.json({ ok: true, queued: ids.length });
});

/* ------------------------------------------------------- booster plan */

app.get("/api/booster-plan", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 120), 500);
  const data = buildScheduleExport(14);
  res.json({ boosterPlan: data.boosterPlan.slice(0, limit), counts: data.counts });
});

/** Live analysis progress, so the UI can say what is actually happening. */
app.get("/api/analysis", (_req, res) => {
  res.json({ ...analysisProgress, waiting: pendingMessageCount() });
});

app.post("/api/analyze", async (req, res) => {
  const limit = req.body?.limit ? Number(req.body.limit) : undefined;
  if (isAnalysisRunning()) {
    // Never start a second queue: it would double-process and fight itself.
    return res.json({ ok: true, alreadyRunning: true, progress: analysisProgress });
  }
  void runAnalysisQueue(undefined, limit).catch(() => undefined);
  res.json({ ok: true, started: true });
});

app.post("/api/analyze/cancel", (_req, res) => {
  res.json(cancelAnalysis());
});

app.post("/api/reproject", (_req, res) => {
  const links = rebuildLinks();
  res.json({ linksRebuilt: links, ...projectAll() });
});

/* ----------------------------------------------------------- connections */

/**
 * The whole AI configuration in one shape: every place TheToDo can send a
 * message, with its keys, its catalogue and whether it is the active one. The UI
 * has a single list to reason about instead of a provider setting, a key pool
 * and a separate custom-endpoint table.
 */
app.get("/api/connections", async (req, res) => {
  try {
    res.json(await listConnections({ refresh: req.query.refresh === "1" }));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/** Refresh one connection's catalogue on demand. */
app.post("/api/connections/:id/refresh-models", async (req, res) => {
  try {
    const c = await catalogueFor(String(req.params.id), { force: true });
    res.json({ ok: true, models: c.models, suggested: c.suggested, warning: c.warning });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/api/connections/activate", (req, res) => {
  try {
    activateConnection(String(req.body?.id ?? ""), req.body?.model);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.patch("/api/connections/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    if (req.body?.model !== undefined) await setConnectionModel(id, String(req.body.model));
    if (req.body?.active === true) activateConnection(id, req.body?.model);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Add a connection from a base URL. Models are read and ranked automatically. */
app.post("/api/connections", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const baseUrl = String(req.body?.baseUrl ?? "").trim();
  const apiKey = String(req.body?.apiKey ?? "").trim();
  if (!baseUrl) {
    return res.status(400).json({ error: "Paste the endpoint's base URL, e.g. http://127.0.0.1:11434/v1" });
  }
  try {
    const id = addCustomProvider({ name, baseUrl, apiKey });
    const pid = poolKey(id);
    if (apiKey) addKey(pid, apiKey, "key 1");
    // Read the endpoint's own catalogue so a model can be chosen for it. This
    // has to be the full description: asking for the list without models would
    // always come back empty and silently leave the endpoint model-less.
    const described = await describeConnectionFresh(pid);
    const suggested = described?.suggestedModel ?? null;
    if (suggested) {
      updateCustomProvider(id, { model: suggested });
      activateConnection(pid, suggested);
    }
    res.json({
      ok: true,
      id: pid,
      rowId: id,
      models: described?.models ?? [],
      suggested,
      warning: described?.modelsWarning ?? null,
      connections: await listConnections(),
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.delete("/api/connections/:id", async (req, res) => {
  const id = String(req.params.id);
  try {
    if (!id.startsWith("custom:")) {
      return res.status(400).json({ error: "Built-in services cannot be removed, only ignored." });
    }
    removeCustomProvider(Number(id.slice("custom:".length)));
    // Never leave the app pointed at an endpoint that no longer exists.
    if (getSetting("ai.provider", "") === id) activateConnection("gemini");
    res.json({ ok: true, connections: await listConnections() });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * Send one real message through a connection using each of its keys in turn, and
 * report which work. This is the only honest way to tell whether an endpoint is
 * genuinely usable, because a provider can publish a model list and still reject
 * every request.
 */
app.post("/api/connections/:id/try", async (req, res) => {
  const id = String(req.params.id);
  const model = req.body?.model ? String(req.body.model) : undefined;
  const choice = resolveProviderById(id);
  if (!choice) return res.status(400).json({ error: "Unknown connection." });
  const c0 = (await listConnections()).find((c) => c.id === id);

  const results: Array<{
    keyId: number;
    label: string;
    ok: boolean;
    model?: string;
    switchedToFreeModel?: string;
    error?: string;
  }> = [];
  // A connection with no key of its own (Kilo's free tier) is tried once with no
  // key at all, which is exactly how that tier is meant to be used.
  const targets: Array<{ id: number; label: string; key_value: string; enabled: number }> =
    listKeys(id).length
      ? listKeys(id)
      : [{ id: 0, label: "no key needed", key_value: "", enabled: 1 }];

  for (const k of targets) {
    if (!k.enabled) continue;
    try {
      // Go through the real rotating path so this genuinely tests what a
      // message would experience, including the paid -> free model fallback.
      const out = await completeWithPool(
        choice,
        {
          messages: [
            { role: "system", content: "You reply with one JSON object and nothing else." },
            { role: "user", content: 'Return exactly {"ok":true}' },
          ],
          temperature: 0,
          maxTokens: 1500,
          model: model || c0?.model || undefined,
          jsonMode: true,
          timeoutMs: 90_000,
        },
        k.key_value || undefined,
      );
      if (k.id) report(k.id, "ok");
      results.push({
        keyId: k.id,
        label: k.label,
        ok: true,
        model: out.model,
        switchedToFreeModel: out.switchedToFreeModel,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (k.id) report(k.id, classify(message), message);
      results.push({ keyId: k.id, label: k.label, ok: false, error: message });
    }
  }

  res.json({
    ok: results.some((r) => r.ok),
    results,
    elapsedMs: results.length ? Date.now() : 0,
  });
});

/* ------------------------------------------------- Telegram credentials */

/**
 * Telegram API credentials can come from the environment or be set here. The
 * settings form writes to the database; the env file still wins when both are
 * present, which is the behaviour someone who configured .env expects.
 */
app.get("/api/telegram-credentials", (_req, res) => {
  const fromEnv = Boolean(MTP_CONFIGURED);
  res.json({
    configured: fromEnv || (getSetting("tg.apiId", "") !== "" && getSetting("tg.apiHash", "") !== ""),
    source: fromEnv ? "environment" : getSetting("tg.apiId", "") ? "settings" : "none",
    apiId: fromEnv ? maskKey(String(process.env.TG_API_ID ?? "")) : maskKey(getSetting("tg.apiId", "")),
    apiHash: fromEnv
      ? maskKey(String(process.env.TG_API_HASH ?? ""))
      : maskKey(getSetting("tg.apiHash", "")),
    envPath: path.join(APP_ROOT, ".env"),
  });
});

app.patch("/api/telegram-credentials", (req, res) => {
  const apiId = req.body?.apiId !== undefined ? String(req.body.apiId).trim() : null;
  const apiHash = req.body?.apiHash !== undefined ? String(req.body.apiHash).trim() : null;
  if (apiId !== null) setSetting("tg.apiId", apiId);
  if (apiHash !== null) setSetting("tg.apiHash", apiHash);
  res.json({ ok: true, note: "Restart TheToDo for new credentials to take effect." });
});

/* ------------------------------------------------------------- key pool */

app.get("/api/keys", (_req, res) => {
  const keys = listKeys().map((k) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    masked: maskKey(k.key),
    status: k.status,
    enabled: k.enabled === 1,
    disabledUntil: k.disabledUntil,
    coolingDown: k.disabledUntil > Date.now(),
    ok: k.stats.ok_count,
    fail: k.stats.fail_count,
    used: k.stats.used_count,
    lastUsed: k.stats.last_used_at,
    lastOk: k.stats.last_ok_at,
    lastError: k.last_error,
  }));
  const custom = listCustomProviders();
  res.json({
    keys,
    customProviders: custom.map((c) => ({
      id: c.id,
      name: c.name,
      baseUrl: c.baseUrl,
      masked: c.apiKey ? maskKey(c.apiKey) : null,
      model: c.model,
      enabled: c.enabled === 1,
      providerId: `custom:${c.id}`,
    })),
    summary: Object.fromEntries(
      [...new Set(keys.map((k) => k.provider))].map((p) => [
        p,
        {
          total: totalCount(p),
          available: availableCount(p),
          active: keys.filter((k) => k.provider === p && k.status === "active").length,
          rateLimited: keys.filter((k) => k.provider === p && k.status === "rate_limited").length,
          invalid: keys.filter((k) => k.provider === p && k.status === "invalid").length,
        },
      ]),
    ),
  });
});

app.post("/api/keys", async (req, res) => {
  const provider = String(req.body?.provider ?? "");
  const key = String(req.body?.key ?? "").trim();
  if (!provider || !key) return res.status(400).json({ error: "Pick a provider and paste a key." });
  if (listCustomProviders().every((c) => `custom:${c.id}` !== provider) && !PROVIDERS[provider]) {
    return res.status(400).json({ error: "Unknown provider." });
  }
  const id = addKey(provider, key, String(req.body?.label ?? ""));
  // On the first key for a provider, choose the best free Sinhala model that
  // provider actually offers, so the app is never left guessing.
  const picked = await autoSelectModel(provider);
  res.json({ ok: true, id, suggestedModel: picked });
});

app.patch("/api/keys/:id", (req, res) => {
  const id = Number(req.params.id);
  updateKey(id, {
    label: req.body?.label,
    enabled: req.body?.enabled,
    status: req.body?.status,
    key: req.body?.key,
  });
  res.json({ ok: true, keys: listKeys() });
});

app.delete("/api/keys/:id", (req, res) => {
  removeKey(Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/keys/revive", (req, res) => {
  const provider = String(req.body?.provider ?? "");
  res.json({ ok: true, revived: provider ? revive(provider) : 0 });
});

/** Probe each key so the student can see which are genuinely working. */
app.post("/api/keys/test", async (req, res) => {
  const results: Array<{ id: number; ok: boolean; error?: string; model?: string }> = [];
  const targets = req.body?.id
    ? listKeys().filter((k) => k.id === Number(req.body.id))
    : listKeys();

  for (const k of targets) {
    const choice =
      k.provider.startsWith("custom:")
        ? null
        : {
            provider: getProvider(k.provider),
            poolKey: k.provider,
            available: 1,
            total: 1,
          };
    if (!choice) {
      results.push({ id: k.id, ok: false, error: "Custom endpoints are tested by sending a message." });
      continue;
    }
    try {
      const out = await completeWithPool(
        { ...choice, poolKey: `__probe__${k.id}` },
        {
          messages: [
            { role: "system", content: "You reply with one JSON object and nothing else." },
            { role: "user", content: 'Return exactly {"ok":true}' },
          ],
          temperature: 0,
          maxTokens: 800,
          jsonMode: true,
          timeoutMs: 90_000,
        },
        k.key,
      );
      report(k.id, "ok");
      results.push({ id: k.id, ok: true, model: out.model });
    } catch (err) {
      const message = (err as Error).message;
      report(k.id, classify(message), message);
      results.push({ id: k.id, ok: false, error: message });
    }
  }
  res.json({ results });
});

/* ------------------------------------------------- custom endpoints */

app.get("/api/custom-providers", (_req, res) => {
  res.json(
    listCustomProviders().map((c) => ({
      id: c.id,
      name: c.name,
      baseUrl: c.baseUrl,
      masked: c.apiKey ? maskKey(c.apiKey) : null,
      model: c.model,
      enabled: c.enabled === 1,
    })),
  );
});

app.post("/api/custom-providers", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const baseUrl = String(req.body?.baseUrl ?? "").trim();
  const apiKey = String(req.body?.apiKey ?? "").trim();
  if (!baseUrl) return res.status(400).json({ error: "A base URL is required." });
  try {
    const id = addCustomProvider({ name, baseUrl, apiKey });
    if (apiKey) addKey(`custom:${id}`, apiKey, "primary");
    // Pull the endpoint's own catalogue and rank it for Sinhala.
    const cp = getCustomProvider(id);
    const fetched = cp ? await fetchModels(cp) : { models: [] };
    const suggested = suggestModel(fetched.models);
    if (cp && suggested) updateCustomProvider(id, { model: suggested.id });
    res.json({
      ok: true,
      id,
      models: rankForSinhala(fetched.models).slice(0, 200),
      suggested: suggested?.id ?? null,
      why: suggested?.why ?? null,
      warning: fetched.warning,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.patch("/api/custom-providers/:id", (req, res) => {
  try {
    const updated = updateCustomProvider(Number(req.params.id), {
      name: req.body?.name,
      baseUrl: req.body?.baseUrl,
      apiKey: req.body?.apiKey,
      model: req.body?.model,
      enabled: req.body?.enabled,
    });
    res.json(updated ?? { error: "not found" });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/custom-providers/:id", (req, res) => {
  removeCustomProvider(Number(req.params.id));
  res.json({ ok: true });
});

/** Models an endpoint offers, ranked for Sinhala, with a recommendation. */
app.get("/api/custom-providers/:id/models", async (req, res) => {
  const cp = getCustomProvider(Number(req.params.id));
  if (!cp) return res.status(404).json({ error: "not found" });
  const fetched = await fetchModels(cp);
  const ranked = rankForSinhala(fetched.models);
  const suggested = suggestModel(fetched.models);
  res.json({ models: ranked, suggested: suggested?.id ?? null, warning: fetched.warning });
});

/* ------------------------------------------------- models, ranked */

app.get("/api/models", async (req, res) => {
  const providerId = String(req.query.provider ?? "gemini");
  try {
    const models = await modelsFor(providerId);
    const ranked = rankForSinhala(models);
    res.json({ provider: providerId, models: ranked, suggested: suggestModel(models)?.id ?? null });
  } catch (e) {
    res.status(200).json({ provider: providerId, models: [], error: (e as Error).message });
  }
});

/** Connectivity check for the AI provider, using the saved key. */
app.post("/api/test-ai", async (req, res) => {
  const providerId = String(req.body?.provider ?? getSetting("ai.provider", "gemini"));
  const model = req.body?.model ? String(req.body.model) : undefined;
  const provider = getProvider(providerId);
  const settings = aiSettings();
  if (!provider.isConfigured(settings.apiKey)) {
    // An expected state, not a server error: the UI renders `ok`/`error`
    // regardless of status, and 200 keeps this endpoint uniform.
    return res.json({ ok: false, error: "No API key saved for this provider yet." });
  }
  try {
    const result = await provider.complete(
      {
        messages: [
          { role: "system", content: "You reply with a single JSON object and nothing else." },
          { role: "user", content: 'Return exactly {"ok":true}' },
        ],
        temperature: 0,
        // Gemini's Flash models spend a few hundred tokens reasoning before
        // answering, so a tiny budget reports MAX_TOKENS with no text at all
        // and looks like a broken key when it is not.
        maxTokens: 800,
        model,
        jsonMode: true,
        timeoutMs: 60_000,
      },
      settings.apiKey,
    );
    res.json({ ok: true, latencyMs: result.latencyMs, model: result.model });
  } catch (e) {
    res.json({ ok: false, error: (e as Error).message });
  }
});

/* ---------------------------------------------------------------- settings */

app.get("/api/settings", (_req, res) => {
  res.json(publicSettings());
});

app.patch("/api/settings", (req, res) => {
  const map: Record<string, string> = {
    provider: "ai.provider",
    model: "ai.model",
    batchSize: "ai.batchSize",
    maxTokens: "ai.maxTokens",
    temperature: "ai.temperature",
    useLayaTriage: "ai.useLayaTriage",
    layaEndpoint: "ai.layaEndpoint",
    autoSyncMinutes: "sync.minutes",
    autoSyncEnabled: "sync.auto",
    apiKey: "ai.apiKey",
  };
  for (const [key, settingKey] of Object.entries(map)) {
    if (req.body[key] !== undefined) setSetting(settingKey, req.body[key]);
  }
  const s = aiSettings();
  startScheduler(() => s.autoSyncMinutes, () => s.autoSyncEnabled);
  res.json(publicSettings());
});

/* ---------------------------------------------------------------- telegram */

app.get("/api/telegram/login/state", (_req, res) => {
  res.json(loginState());
});

app.post("/api/telegram/login/start", (req, res) => {
  try {
    res.json(startLogin(String(req.body.phone ?? "")));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.post("/api/telegram/login/code", (req, res) => {
  const r = submitCode(String(req.body.code ?? ""));
  res.status(r.ok ? 200 : 400).json(r);
});

app.post("/api/telegram/login/password", (req, res) => {
  const r = submitPassword(String(req.body.password ?? ""));
  res.status(r.ok ? 200 : 400).json(r);
});

app.get("/api/telegram/me", async (_req, res) => {
  res.json({
    account: await me().catch(() => null),
    configured: MTP_CONFIGURED,
    authorized: await isAuthorized().catch(() => false),
  });
});

app.post("/api/telegram/logout", async (_req, res) => {
  res.json(await logout());
});

/* ---------------------------------------------------------------- SSE live */

app.get("/api/events/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "hello", progress })}\n\n`);

  const off = onProgress((p) => {
    res.write(`data: ${JSON.stringify({ type: "progress", progress: p })}\n\n`);
  });
  const beat = setInterval(() => res.write(": ping\n\n"), 25_000);

  req.on("close", () => {
    off();
    clearInterval(beat);
  });
});

/* ------------------------------------------------------------------ notes */

/*
 * The engine serves no interface. It is an API for the desktop app, which
 * already renders everything, and the two only ever meet over these routes and
 * the exported schedule file. Anything the engine returns that the app does not
 * read is dead weight, so it is worth checking the two against each other —
 * `tools/check-sync.mjs` does that.
 */

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[engine]", err);
  res.status(500).json({ error: err.message });
});

/* ------------------------------------------------------------- bootstrap */

export interface RunningServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

/** Serve on `port`; pass 0 to let the OS pick a free one (used by the desktop app). */
export function startServer(port = PORT, quiet = false): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, async () => {
      const s = aiSettings();
      try {
        await refreshMode();
      } catch {
        /* the mode is best-effort; /api/state recomputes it on demand */
      }
      const actual = (server.address() as { port: number }).port;
      const url = `http://localhost:${actual}`;
      if (!quiet) {
        console.log(`\n  TheToDo reading engine  ->  ${url}`);
        console.log(`  mode: ${currentMode()}   ai: ${s.provider} (${providerReady(s) ? "ready" : "no key"})`);
        console.log(`  data: ${DATA_DIR}\n`);
      }
      markImportantMessages();
      startScheduler(() => aiSettings().autoSyncMinutes, () => aiSettings().autoSyncEnabled);
      resolve({
        port: actual,
        url,
        close: () =>
          new Promise<void>((done) => {
            stopScheduler();
            void disconnect().finally(() => server.close(() => done()));
          }),
      });
    });
    server.once("error", reject);
  });
}

export { app };

// TheToDo never auto-starts on import. `server/src/serve.ts` is the command-line
// entry point for running it from source, and the desktop bundle has its own
// launcher — so importing the server (from tools or tests) stays side-effect
// free.
