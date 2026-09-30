import { db } from "../db/index.js";
import { DATA_DIR } from "../paths.js";
import fs from "node:fs";
import path from "node:path";

/**
 * Read an attachment's text on this machine, and keep the file itself away from
 * the model.
 *
 * A paper PDF can be megabytes and a scanned image is unreadable without OCR.
 * Sending either to a model wastes the request and, on a free tier, most of
 * that request's budget. So a PDF is fetched once, turned into text here, and
 * only a short excerpt is ever included in a prompt. The extracted text is
 * cached, so re-reading a message costs nothing.
 */

export interface AttachmentText {
  ok: boolean;
  kind: "pdf" | "text" | "image" | "none";
  chars: number;
  /** Bounded excerpt, safe to put in a prompt. */
  excerpt: string;
  pages?: number;
  reason?: string;
}

/** Never send more than this from any attachment, whatever its size. */
const EXCERPT_CHARS = 1200;

export function isPdfName(name: string | null | undefined): boolean {
  return /\.pdf$/i.test(name ?? "");
}

export function isImageKind(kind: string | null | undefined): boolean {
  return kind === "photo" || kind === "image";
}

/**
 * Load pdf-parse, which is optional.
 *
 * The codebase is ESM under tsx but is bundled to CommonJS for the desktop app,
 * and `require` does not exist in the first. A dynamic import covers both: esbuild
 * rewrites it to a require call for the external package when emitting CommonJS.
 */
async function loadPdfParse(): Promise<any | null> {
  try {
    const mod: any = await import("pdf-parse");
    return mod?.PDFParse ?? mod?.default?.PDFParse ?? null;
  } catch {
    try {
      const req = (globalThis as any).require;
      if (typeof req !== "function") return null;
      const mod = req("pdf-parse");
      return mod?.PDFParse ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Extract text from a PDF already on disk. Returns null when the file is not
 * present, is not a PDF, or yields nothing readable — which is the normal case
 * for a scan, and is not an error worth surfacing.
 */
export async function readPdfOnDisk(
  file: string,
): Promise<{ text: string; pages?: number } | null> {
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  if (stat.size === 0) return null;
  // Refuse anything implausibly large rather than reading it into memory.
  if (stat.size > 40 * 1024 * 1024) return null;

  const PDFParse = await loadPdfParse();
  if (!PDFParse) return null;

  let parser: any;
  try {
    parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
    const result = await parser.getText();
    const text = String(result?.text ?? "")
      .replace(/\u0000/g, "")
      .trim();
    if (!text) return null;
    return { text, pages: result?.total ?? result?.pages?.length };
  } catch (err) {
    if (process.env.THETODO_DEBUG_PDF) {
      console.warn(`[theTodo:engine] pdf read failed for ${file}:`, (err as Error).message);
    }
    return null;
  } finally {
    // v2 holds worker resources open unless the parser is destroyed.
    try {
      await parser?.destroy?.();
    } catch {
      /* nothing to do */
    }
  }
}

/** Trim an extracted document down to what is worth sending. */
export function excerpt(text: string): string {
  // Collapse the whitespace that PDF extraction leaves everywhere, then keep
  // the head: a question list starts at the top, and a truncated tail of page
  // furniture is noise.
  const clean = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= EXCERPT_CHARS) return clean;
  return `${clean.slice(0, EXCERPT_CHARS)}\n[...truncated, ${clean.length - EXCERPT_CHARS} more characters]`;
}

export interface CachedText {
  messageId: number;
  kind: string;
  chars: number;
  excerpt: string;
  pages: number | null;
  extractedAt: number;
}

function cacheFor(messageId: number): CachedText | undefined {
  return db
    .prepare(
      `SELECT message_id, kind, chars, excerpt, pages, extracted_at FROM attachment_text WHERE message_id = ?`,
    )
    .get(messageId) as any;
}

export function cachedExcerpt(messageId: number): string | null {
  const row = cacheFor(messageId);
  return row?.excerpt || null;
}

/**
 * Make sure an attachment's text is available locally, downloading it once if
 * this is the first time we have looked at it. Never throws: a paper we cannot
 * read simply leaves the prompt as it was.
 */
export async function ensureAttachmentText(messageId: number): Promise<AttachmentText | null> {
  const row = db
    .prepare(
      `SELECT m.id, m.media_kind, m.media_name, c.username
       FROM messages m JOIN channels c ON c.id = m.channel_id
       WHERE m.id = ?`,
    )
    .get(messageId) as any;
  if (!row || !row.media_kind) return null;

  // Images are deliberately not sent anywhere. Reading them needs vision, which
  // costs a lot and adds nothing: a teacher's photo is a poster, not a schedule.
  if (isImageKind(row.media_kind)) {
    return { ok: false, kind: "image", chars: 0, excerpt: "", reason: "image attachments are not sent to the model" };
  }

  const cached = cacheFor(messageId);
  if (cached) {
    return {
      ok: true,
      kind: cached.kind === "pdf" ? "pdf" : "text",
      chars: cached.chars,
      excerpt: cached.excerpt,
      pages: cached.pages ?? undefined,
    };
  }

  if (!isPdfName(row.media_name) && !/\.(txt|docx?)$/i.test(row.media_name ?? "")) {
    return { ok: false, kind: "none", chars: 0, excerpt: "", reason: "no readable text format" };
  }

  // Fetch once, then read from disk.
  const file = path.join(DATA_DIR, "media", row.username, `${messageId}.pdf`);
  if (!fs.existsSync(file)) {
    try {
      const { downloadMedia } = await import("../telegram/mtproto.js");
      await downloadMedia(row.username, messageId);
    } catch {
      return {
        ok: false,
        kind: "pdf",
        chars: 0,
        excerpt: "",
        reason: "could not download the attachment",
      };
    }
  }

  const parsed = await readPdfOnDisk(file);
  if (!parsed) {
    db.prepare(
      `INSERT INTO attachment_text (message_id, kind, chars, excerpt, pages, extracted_at)
       VALUES (?, 'pdf', 0, '', NULL, ?)
       ON CONFLICT(message_id) DO UPDATE SET extracted_at = excluded.extracted_at`,
    ).run(messageId, Date.now());
    return {
      ok: false,
      kind: "pdf",
      chars: 0,
      excerpt: "",
      reason: "no selectable text, so it is probably a scan",
    };
  }

  const ex = excerpt(parsed.text);
  db.prepare(
    `INSERT INTO attachment_text (message_id, kind, chars, excerpt, pages, extracted_at)
     VALUES (?, 'pdf', ?, ?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET
       kind = excluded.kind, chars = excluded.chars, excerpt = excluded.excerpt,
       pages = excluded.pages, extracted_at = excluded.extracted_at`,
  ).run(messageId, parsed.text.length, ex, parsed.pages ?? null, Date.now());

  return {
    ok: true,
    kind: "pdf",
    chars: parsed.text.length,
    excerpt: ex,
    pages: parsed.pages,
  };
}
