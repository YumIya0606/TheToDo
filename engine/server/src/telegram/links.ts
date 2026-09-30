import type { LinkKind } from "../../../../shared/types.js";

const URL_RE = /\bhttps?:\/\/[^\s<>"'\]}]+/gi;

const RULES: Array<{ kind: LinkKind; test: RegExp }> = [
  { kind: "zoom", test: /(zoom\.us|zoom\.gov|us\d{2}web\.zoom\.us)/i },
  { kind: "zoom", test: /(^|\/)j\/\d{9,}/i },
  { kind: "youtube", test: /(youtube\.com|youtu\.be|youtube-nocookie\.com)/i },
  { kind: "drive", test: /(drive\.google\.com|docs\.google\.com)/i },
  { kind: "pdf", test: /\.pdf(\?|$)/i },
  { kind: "form", test: /(docs\.google\.com\/forms|forms\.gle|microsoft\.com\/forms|typeform|surveymonkey)/i },
  { kind: "tg", test: /(t\.me|telegram\.me)\//i },
];

export function classifyLink(rawUrl: string): LinkKind {
  let u = rawUrl;
  try {
    u = new URL(rawUrl).toString();
  } catch {
    return "web";
  }
  for (const r of RULES) if (r.test.test(u)) return r.kind;
  return "web";
}

export function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export interface ExtractedLink {
  url: string;
  kind: LinkKind;
  host: string;
}

/** Pull every distinct URL out of message text, normalising trailing punctuation. */
export function extractLinks(text: string): ExtractedLink[] {
  const seen = new Map<string, ExtractedLink>();
  for (const match of text.match(URL_RE) ?? []) {
    // Telegram text often appends sentence punctuation directly to the URL.
    const url = match.replace(/[.,;:!?)\]]+$/, "");
    if (!/^https?:\/\/.+/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.set(url, { url, kind: classifyLink(url), host: hostOf(url) });
  }
  return [...seen.values()];
}

/** Zoom join links are only useful when they are a real joinable webinar link. */
export function isJoinableZoom(url: string): boolean {
  if (!/zoom\.us/i.test(url)) return false;
  return /(j\/\d{9,}|webinar\/register|wc\/join)/i.test(url);
}
