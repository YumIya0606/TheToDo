import { db } from "./index.js";
import type { Channel } from "../../../../shared/types.js";
import type { ScrapedMessage } from "../telegram/webpreview.js";
import { classifyLink, extractLinks, hostOf } from "../telegram/links.js";

export interface InsertResult {
  fetched: number;
  inserted: number;
  newestId: number;
  oldestId: number;
}

/** Insert normalised messages for a channel. Idempotent on (channel, msgId, source). */
export function storeMessages(
  channelId: number,
  source: "mtproto" | "webpreview",
  messages: ScrapedMessage[],
): InsertResult {
  const now = Date.now();
  const insertMsg = db.prepare(`
    INSERT INTO messages
      (channel_id, msg_id, date, edit_date, text, raw_text, has_media, media_kind, media_name,
       media_mime, media_size, is_forwarded, forward_from, views, has_reply, reply_to_id,
       grouped_id, source, created_at)
    VALUES
      (@channel_id, @msg_id, @date, @edit_date, @text, @text, @has_media, @media_kind, @media_name,
       @media_mime, @media_size, @is_forwarded, @forward_from, @views, @has_reply, @reply_to_id,
       @grouped_id, @source, @created_at)
    ON CONFLICT(channel_id, msg_id, source) DO UPDATE SET
      text = excluded.text,
      edit_date = excluded.edit_date,
      views = excluded.views
    RETURNING id`);

  const insertLink = db.prepare(`
    INSERT INTO links (message_id, url, kind, label, host)
    VALUES (@message_id, @url, @kind, @label, @host)
    ON CONFLICT(message_id, url) DO UPDATE SET kind = excluded.kind`);

  let inserted = 0;
  let newestId = 0;
  let oldestId = Number.MAX_SAFE_INTEGER;

  const tx = db.transaction((rows: ScrapedMessage[]) => {
    for (const m of rows) {
      const info = insertMsg.get({
        channel_id: channelId,
        msg_id: m.msgId,
        date: m.date,
        edit_date: m.editDate,
        text: m.text,
        has_media: m.hasMedia ? 1 : 0,
        media_kind: m.mediaKind,
        media_name: m.mediaName,
        media_mime: m.mediaMime ?? null,
        media_size: m.mediaSize ?? null,
        is_forwarded: m.isForwarded ? 1 : 0,
        forward_from: m.forwardFrom,
        views: m.views,
        has_reply: m.replyToId ? 1 : 0,
        reply_to_id: m.replyToId,
        grouped_id: m.groupedId,
        source,
        created_at: now,
      }) as { id: number } | undefined;

      const messageId = info?.id;
      if (messageId) {
        for (const l of m.links) {
          insertLink.run({
            message_id: messageId,
            url: l.url,
            kind: l.kind,
            label: linkLabel(l.kind),
            host: l.host,
          });
        }
      }
      if (m.links.length === 0 && m.text) {
        // Re-extract defensively in case a source gave formatted markup.
        for (const raw of m.text.match(/https?:\/\/[^\s<>"'\]}]+/gi) ?? []) {
          const url = raw.replace(/[.,;:!?)\]]+$/, "");
          if (/^https?:\/\//i.test(url)) {
            insertLink.run({
              message_id: messageId,
              url,
              kind: classifyLink(url),
              label: linkLabel(classifyLink(url)),
              host: hostOf(url),
            });
          }
        }
      }

      if (m.msgId > newestId) newestId = m.msgId;
      if (m.msgId < oldestId) oldestId = m.msgId;
      inserted++;
    }
  });

  tx(messages);

  if (newestId > 0) {
    db.prepare("UPDATE channels SET last_scanned_id = MAX(last_scanned_id, ?) WHERE id = ?").run(
      newestId,
      channelId,
    );
  }
  db.prepare("UPDATE channels SET last_sync_at = ? WHERE id = ?").run(now, channelId);

  return {
    fetched: messages.length,
    inserted,
    newestId,
    oldestId: oldestId === Number.MAX_SAFE_INTEGER ? 0 : oldestId,
  };
}

function linkLabel(kind: string): string {
  switch (kind) {
    case "zoom":
      return "Zoom join link";
    case "youtube":
      return "YouTube video";
    case "pdf":
      return "PDF document";
    case "drive":
      return "Google Drive file";
    case "form":
      return "Form";
    case "tg":
      return "Telegram";
    default:
      return "Link";
  }
}

/** Which channels currently have stored history, for incremental sync. */
export function channelsNeedingSync(): Channel[] {
  return db
    .prepare(
      `SELECT * FROM channels
       WHERE enabled = 1
       ORDER BY (last_sync_at IS NULL) DESC, last_sync_at ASC`,
    )
    .all() as Channel[];
}

export function getChannelByUsername(username: string): Channel | undefined {
  return db
    .prepare("SELECT * FROM channels WHERE username = ? COLLATE NOCASE")
    .get(username.replace(/^@/, "")) as Channel | undefined;
}

export function getChannel(id: number): Channel | undefined {
  return db.prepare("SELECT * FROM channels WHERE id = ?").get(id) as Channel | undefined;
}

export function listChannels(): Channel[] {
  return db.prepare("SELECT * FROM channels ORDER BY subject, kind").all() as Channel[];
}

export function markImportantMessages(): void {
  // Cheap heuristic used before any AI has run, so the UI has something to show.
  db.prepare(
    `UPDATE messages SET is_important = 1
     WHERE id IN (
       SELECT m.id FROM messages m
       JOIN channels c ON c.id = m.channel_id
       WHERE LENGTH(m.text) > 40
         AND (
           m.text LIKE '%zoom.us%'
           OR m.text LIKE '%youtube.com%'
           OR m.text LIKE '%youtu.be%'
           OR m.text LIKE '%drive.google%'
           OR LOWER(m.text) LIKE '%postpone%'
            OR m.text LIKE '%දිගලා%'
            OR m.text LIKE '%වෙනුවට%'
         )
     )`,
  ).run();
}

/**
 * Re-derive every link from the stored message text. Links are a pure function
 * of the messages, so they must never depend on the AI pass having run, and
 * re-running this is how a wiped links table is restored.
 */
export function rebuildLinks(): number {
  const rows = db.prepare("SELECT id, text FROM messages").all() as Array<{ id: number; text: string }>;
  const insert = db.prepare(
    `INSERT INTO links (message_id, url, kind, label, host)
     VALUES (@message_id, @url, @kind, @label, @host)
     ON CONFLICT(message_id, url) DO UPDATE SET kind = excluded.kind`,
  );
  const tx = db.transaction((items: Array<{ id: number; text: string }>) => {
    let n = 0;
    for (const m of items) {
      for (const l of extractLinks(m.text ?? "")) {
        insert.run({
          message_id: m.id,
          url: l.url,
          kind: l.kind,
          label: linkLabel(l.kind),
          host: l.host,
        });
        n++;
      }
    }
    return n;
  });
  return tx(rows);
}

export function countMessages(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }).n;
}
