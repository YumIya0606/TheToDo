import * as cheerio from "cheerio";
import { extractLinks } from "./links.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface ScrapedMessage {
  channelUsername: string;
  msgId: number;
  date: number; // unix seconds
  editDate: number | null;
  text: string;
  hasMedia: boolean;
  mediaKind: string | null;
  mediaName: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  isForwarded: boolean;
  forwardFrom: string | null;
  views: number | null;
  replyToId: number | null;
  groupedId: number | null;
  links: Array<{ url: string; kind: string; host: string }>;
}

export interface ScrapePage {
  messages: ScrapedMessage[];
  /** Oldest message id on this page; pass back as `before` to walk further back. */
  oldestId: number | null;
  hasMore: boolean;
  channelTitle: string | null;
  memberCount: number | null;
}

export class PreviewDisabledError extends Error {
  constructor(public username: string) {
    super(
      `Channel @${username} does not expose a public web preview. Connect a Telegram account (MTProto) to read it.`,
    );
    this.name = "PreviewDisabledError";
  }
}

function parseViews(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.trim();
  const m = t.match(/^([\d.]+)\s*([KMB]?)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = /K/i.test(m[2]) ? 1e3 : /M/i.test(m[2]) ? 1e6 : /B/i.test(m[2]) ? 1e9 : 1;
  return Math.round(n * mult);
}

function detectMediaKind(node: cheerio.Cheerio<any>): { kind: string | null; name: string | null } {
  if (node.find(".tgme_widget_message_photo_wrap").length) {
    return { kind: "photo", name: null };
  }
  if (node.find(".tgme_widget_message_video_player, .tgme_widget_message_video").length) {
    return { kind: "video", name: null };
  }
  if (node.find(".tgme_widget_message_roundvideo").length) return { kind: "video", name: null };
  if (node.find(".tgme_widget_message_document").length) {
    const name =
      node.find(".tgme_widget_message_document_name").first().text().trim() ||
      node.find(".tgme_widget_message_document title").first().text().trim() ||
      null;
    return { kind: "document", name };
  }
  if (node.find(".tgme_widget_message_sticker").length) return { kind: "sticker", name: null };
  if (node.find(".tgme_widget_message_video_note, .tgme_widget_message_voice").length) {
    return { kind: "voice", name: null };
  }
  return { kind: null, name: null };
}

/** Parse a /s/<channel> page into normalised messages. */
export function parsePreviewPage(html: string, username: string): ScrapePage {
  const $ = cheerio.load(html);

  const channelTitle =
    $(".tgme_channel_info_header_title").first().text().trim() ||
    $(".tgme_widget_message_owner_name").first().text().trim() ||
    null;

  const subsRaw = $(".tgme_channel_info_counter").first().text().trim();
  const memberCount = parseViews(subsRaw.replace(/subscribers|members|people/i, "").trim());

  const messages: ScrapedMessage[] = [];

  $("div.tgme_widget_message[data-post]").each((_i, el) => {
    const node = $(el);
    const post = node.attr("data-post") ?? "";
    const msgId = Number(post.split("/")[1]);
    if (!Number.isFinite(msgId) || msgId <= 0) return;

    const timeEl = node.find("time[datetime]").first();
    const iso = timeEl.attr("datetime");
    const date = iso ? Math.floor(new Date(iso).getTime() / 1000) : 0;
    if (!date) return;

    // Reply context: Telegram renders a quote block before the real text.
    const replyBlock = node.find(".tgme_widget_message_reply").first();
    const replyToId = (() => {
      if (replyBlock.length === 0) return null;
      const href = replyBlock.find("a").attr("href") ?? "";
      const m = href.match(/\/(\d+)$/);
      return m ? Number(m[1]) : null;
    })();

    const textNode = node.find(".tgme_widget_message_text").first();
    let text = "";
    if (textNode.length) {
      const clone = textNode.clone();
      clone.find("br").replaceWith("\n");
      clone.find("script, style").remove();
      text = clone.text().replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
    }

    const forwardName = node
      .find(".tgme_widget_message_forwarded_from_name")
      .first()
      .text()
      .trim();
    const forwardFrom = forwardName || null;

    const views = parseViews(node.find(".tgme_widget_message_views").first().text().trim() || null);
    const { kind: mediaKind, name: mediaName } = detectMediaKind(node);

    // Some posts are only a link preview with no message text of their own.
    if (!text) {
      const previewHref = node.find("a.tgme_widget_message_link_preview").first().attr("href");
      if (previewHref) text = previewHref;
    }

    // Grouped albums: the wrap element id encodes the group.
    const wrapId = node.closest(".tgme_widget_message_wrap").attr("id") ?? "";
    const gm = wrapId.match(/^tgme_widget_message_wrap_(\d+)/);
    const groupedId = gm ? Number(gm[1]) : null;

    messages.push({
      channelUsername: post.split("/")[0] ?? username,
      msgId,
      date,
      editDate: null,
      text,
      hasMedia: Boolean(mediaKind),
      mediaKind,
      mediaName,
      isForwarded: Boolean(forwardFrom),
      forwardFrom,
      views,
      replyToId,
      groupedId,
      links: extractLinks(text).map((l) => ({ url: l.url, kind: l.kind, host: l.host })),
    });
  });

  const ids = messages.map((m) => m.msgId);
  const oldestId = ids.length ? Math.min(...ids) : null;
  const hasMore = Boolean($("a.tme_messages_more[data-before]").first().attr("data-before"));

  return { messages, oldestId, hasMore, channelTitle, memberCount };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ScrapeOptions {
  /** How many pages deep to walk backwards. One page ~= 20 messages. */
  pages?: number;
  /** Stop once this many messages older than this unix ts are collected. */
  beforeTs?: number;
  signal?: AbortSignal;
  onProgress?: (page: number, found: number) => void;
}

/**
 * Walk the public /s/ preview backwards. No Telegram account required.
 * Throws PreviewDisabledError when the channel does not expose a preview.
 */
export async function scrapePublicPreview(
  username: string,
  opts: ScrapeOptions = {},
): Promise<ScrapePage> {
  const handle = username.replace(/^@/, "");
  const pages = Math.max(1, opts.pages ?? 3);
  const out: ScrapedMessage[] = [];
  let before: string | null = null;
  let title: string | null = null;
  let memberCount: number | null = null;
  let sawMessage = false;

  for (let page = 0; page < pages; page++) {
    const url = before
      ? `https://t.me/s/${handle}?before=${before}`
      : `https://t.me/s/${handle}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`t.me/s/${handle} returned HTTP ${res.status}`);
    const html = await res.text();
    const parsed = parsePreviewPage(html, handle);

    if (!sawMessage && parsed.messages.length === 0) {
      // One retry after a short pause: Telegram rate-limits bursts with an empty shell.
      await sleep(1500);
      const retry = await fetch(url, { headers: { "User-Agent": UA }, signal: opts.signal });
      const retryHtml = await retry.text();
      const retryParsed = parsePreviewPage(retryHtml, handle);
      if (retryParsed.messages.length === 0) throw new PreviewDisabledError(handle);
      title ??= retryParsed.channelTitle;
      memberCount ??= retryParsed.memberCount;
      out.push(...retryParsed.messages);
      before = retryParsed.oldestId != null ? String(retryParsed.oldestId) : null;
      sawMessage = true;
      opts.onProgress?.(page + 1, out.length);
      if (!retryParsed.hasMore || before === null) break;
      continue;
    }

    title ??= parsed.channelTitle;
    memberCount ??= parsed.memberCount;
    sawMessage = true;
    out.push(...parsed.messages);
    opts.onProgress?.(page + 1, out.length);

    const stop = opts.beforeTs != null && parsed.messages.every((m) => m.date < opts.beforeTs!);
    if (!parsed.hasMore || parsed.oldestId == null || stop) break;
    before = String(parsed.oldestId);
    await sleep(1200); // be polite to t.me
  }

  const ids = out.map((m) => m.msgId);
  return {
    messages: out,
    oldestId: ids.length ? Math.min(...ids) : null,
    hasMore: before !== null,
    channelTitle: title,
    memberCount,
  };
}
