import { Api, TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";
import { auth as tgAuth, downloads as tgDownloads } from "teleproto/client";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../db/index.js";
import { getSetting } from "../db/index.js";
import type { ScrapedMessage } from "./webpreview.js";
import { extractLinks } from "./links.js";

const SESSION_FILE = path.join(DATA_DIR, "telegram.session");

/**
 * Credentials come from the environment when set, otherwise from the app's own
 * settings, so a student can configure this from the interface without editing
 * a file and restarting into a build step.
 */
const API_ID = Number(process.env.TG_API_ID ?? (getSetting("tg.apiId", "") as string) ?? 0);
const API_HASH =
  (process.env.TG_API_HASH as string) || (getSetting("tg.apiHash", "") as string) || "";

export const MTP_CONFIGURED = Boolean(API_ID && API_HASH);
export const SESSION_PATH = SESSION_FILE;
export const PHONE_NUMBER_REQUIRED = "PHONE_NUMBER_REQUIRED";
export const API_CREDENTIALS_REQUIRED = "API_CREDENTIALS_REQUIRED";

let client: TelegramClient<StringSession> | null = null;
let connecting: Promise<TelegramClient<StringSession>> | null = null;
let authorized: boolean | null = null;

export function hasStoredSession(): boolean {
  return fs.existsSync(SESSION_FILE);
}

function readSession(): StringSession {
  if (!fs.existsSync(SESSION_FILE)) return new StringSession("");
  return new StringSession(fs.readFileSync(SESSION_FILE, "utf8").trim());
}

function writeSession(str: string): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, str, "utf8");
  try {
    fs.chmodSync(SESSION_FILE, 0o600);
  } catch {
    /* chmod is a no-op on Windows */
  }
}

async function buildClient(): Promise<TelegramClient<StringSession>> {
  if (!MTP_CONFIGURED) throw new Error(API_CREDENTIALS_REQUIRED);
  const c = new TelegramClient(readSession(), API_ID, API_HASH, {
    connectionRetries: 3,
    retryDelay: 1500,
  });
  await c.connect();
  authorized = await c.isUserAuthorized();
  client = c;
  return c;
}

export async function getClient(): Promise<TelegramClient<StringSession>> {
  if (client) return client;
  if (!connecting) connecting = buildClient().finally(() => (connecting = null));
  return connecting;
}

export function isAuthorizedSync(): boolean {
  return authorized ?? hasStoredSession();
}

export async function isAuthorized(): Promise<boolean> {
  if (!MTP_CONFIGURED) return false;
  try {
    authorized = await (await getClient()).isUserAuthorized();
  } catch {
    authorized = false;
  }
  return authorized;
}

/* ------------------------------------------------------------------ login */

export type LoginStage =
  | "idle"
  | "awaiting-code"
  | "awaiting-password"
  | "done"
  | "error";

interface PendingLogin {
  stage: LoginStage;
  phone: string;
  hint: string | null;
  error: string | null;
  codeResolver: ((code: string) => void) | null;
  passResolver: ((pw: string) => void) | null;
  flow: Promise<void> | null;
}

let pending: PendingLogin | null = null;

export function loginState(): {
  stage: LoginStage;
  hint: string | null;
  error: string | null;
  running: boolean;
} {
  return {
    stage: pending?.stage ?? "idle",
    hint: pending?.hint ?? null,
    error: pending?.error ?? null,
    running: Boolean(pending?.flow),
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/**
 * Kick off the interactive MTProto login. Telegram's flow needs the code and
 * (sometimes) the 2FA password to be supplied after the flow has started, so
 * the flow runs in the background and the UI feeds it input via the HTTP API.
 */
export function startLogin(phone: string): { started: true; phone: string } {
  if (!MTP_CONFIGURED) throw new Error(API_CREDENTIALS_REQUIRED);
  if (pending?.flow) throw new Error("A login is already in progress.");

  const normalised = phone.replace(/[\s()-]/g, "");
  const code = deferred<string>();
  const pass = deferred<string>();

  const state: PendingLogin = {
    stage: "awaiting-code",
    phone: normalised,
    hint: null,
    error: null,
    codeResolver: (c) => code.resolve(c),
    passResolver: (p) => pass.resolve(p),
    flow: null,
  };
  pending = state;

  state.flow = (async () => {
    try {
      const c = await getClient();
      if (await c.isUserAuthorized()) {
        state.stage = "done";
        authorized = true;
        return;
      }
      await tgAuth.start(c, {
        phoneNumber: normalised,
        phoneCode: async () => {
          state.stage = "awaiting-code";
          return code.promise;
        },
        password: async (hint?: string) => {
          state.hint = hint ?? null;
          state.stage = "awaiting-password";
          return pass.promise;
        },
        onError: async (err) => {
          state.error = (err as Error).message;
          state.stage = "error";
          return true; // stop the flow
        },
      });
      authorized = true;
      state.stage = "done";
      if (c.session) writeSession(c.session.save());
    } catch (err) {
      state.error = (err as Error).message;
      state.stage = "error";
    }
  })();

  return { started: true, phone: normalised };
}

export function submitCode(code: string): { ok: true } | { ok: false; error: string } {
  if (!pending?.codeResolver) return { ok: false, error: "No login is waiting for a code." };
  const c = code.trim();
  if (!/^\d{4,8}$/.test(c)) return { ok: false, error: "The login code is 4 to 8 digits." };
  pending.codeResolver(c);
  pending.codeResolver = null;
  return { ok: true };
}

export function submitPassword(password: string): { ok: true } | { ok: false; error: string } {
  if (!pending?.passResolver) return { ok: false, error: "No login is waiting for a password." };
  if (!password) return { ok: false, error: "Password is empty." };
  pending.passResolver(password);
  pending.passResolver = null;
  return { ok: true };
}

export function clearPendingLogin(): void {
  pending = null;
}

export async function me(): Promise<{
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
} | null> {
  if (!MTP_CONFIGURED || !(await isAuthorized())) return null;
  try {
    const c = await getClient();
    const u = await c.getMe();
    return {
      id: Number(u.id),
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
    };
  } catch {
    return null;
  }
}

export async function logout(): Promise<{ status: string }> {
  if (client) {
    try {
      if (await client.isUserAuthorized()) await client.logOut();
    } catch {
      /* ignore */
    }
    try {
      await client.destroy();
    } catch {
      /* ignore */
    }
  }
  client = null;
  connecting = null;
  authorized = false;
  pending = null;
  if (fs.existsSync(SESSION_FILE)) fs.rmSync(SESSION_FILE);
  return { status: "logged-out" };
}

export async function disconnect(): Promise<void> {
  if (client) {
    try {
      await client.destroy();
    } catch {
      /* ignore */
    }
  }
  client = null;
  connecting = null;
  authorized = null;
}

/* ----------------------------------------------------------------- reading */

export interface FetchOptions {
  limit?: number;
  offsetId?: number;
  onProgress?: (got: number) => void;
}

function toScraped(msg: any, username: string): ScrapedMessage {
  const text: string = msg.message ?? msg.text ?? "";
  const mediaKind = msg.photo
    ? "photo"
    : msg.video || msg.videoNote
      ? "video"
      : msg.document
        ? "document"
        : msg.sticker
          ? "sticker"
          : msg.voice
            ? "voice"
            : null;

  const mediaName: string | null =
    msg.document?.fileName ??
    msg.document?.attributes?.find?.((a: any) => a?.fileName)?.fileName ??
    null;

  return {
    channelUsername: username,
    msgId: msg.id,
    date: msg.date,
    editDate: msg.editDate ?? null,
    text,
    hasMedia: Boolean(mediaKind),
    mediaKind,
    mediaName,
    mediaMime: msg.document?.mimeType ?? null,
    mediaSize: msg.document?.size ?? null,
    isForwarded: Boolean(msg.forwardDate),
    forwardFrom: msg.forwardFrom?.chat?.title ?? msg.forwardFrom?.channel?.title ?? null,
    views: msg.views ?? null,
    replyToId: msg.replyTo?.replyToMsgId ?? null,
    groupedId: msg.groupedId ?? null,
    links: extractLinks(text).map((l) => ({ url: l.url, kind: l.kind, host: l.host })),
  };
}

export async function fetchChannelMessages(
  username: string,
  opts: FetchOptions = {},
): Promise<ScrapedMessage[]> {
  const c = await getClient();
  const handle = username.replace(/^@/, "");
  const entity = await c.getEntity(handle);

  const limit = opts.limit ?? 200;
  const params: Record<string, unknown> = { limit };
  if (opts.offsetId && opts.offsetId > 0) params.offsetId = opts.offsetId;

  const out: ScrapedMessage[] = [];
  for await (const msg of c.iterMessages(entity, params as any)) {
    if (typeof (msg as any).id !== "number") continue;
    out.push(toScraped(msg, handle));
    opts.onProgress?.(out.length);
    if (out.length >= limit) break;
  }
  return out;
}

/** Download a message's media into data/media and return the local path. */
export async function downloadMedia(username: string, msgId: number): Promise<string | null> {
  const c = await getClient();
  const handle = username.replace(/^@/, "");
  const entity = await c.getEntity(handle);
  const got = await c.getMessages(entity, { ids: [msgId] });
  const list = (got as unknown as { messages?: unknown[] }).messages ?? (got as unknown as unknown[]);
  const m: any = Array.isArray(list) ? list[0] : list;
  if (!m?.media) return null;

  const dir = path.join(DATA_DIR, "media", handle);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${msgId}${extFor(m)}`);
  if (fs.existsSync(target)) return target;

  await tgDownloads.downloadMedia(c, m, target);
  return fs.existsSync(target) ? target : null;
}

function extFor(m: any): string {
  const name: string | undefined = m.document?.fileName;
  if (name) {
    const dot = name.lastIndexOf(".");
    if (dot > -1) return name.slice(dot);
  }
  const mime: string = m.document?.mimeType ?? "";
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg")) return ".jpg";
  return m.video || m.videoNote ? ".mp4" : m.photo ? ".jpg" : ".bin";
}

export { Api };
