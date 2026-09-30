import { z } from "zod";
import type { ClassType, MessageKind, StatusChange, Urgency } from "../../../../shared/types.js";
import type { RuleHints } from "./prefilter.js";

export const PROMPT_VERSION = "v1";

const KINDS = [
  "class_announcement",
  "class_reminder",
  "postponement",
  "cancellation",
  "time_change",
  "live_now",
  "join_link",
  "recording",
  "material",
  "paper",
  "test",
  "booster",
  "question_set",
  "result",
  "fee_notice",
  "general_notice",
  "chat",
  "reaction",
  "irrelevant",
] as const;

/**
 * Deliberately lenient. A model that reasons out loud, or that omits a field it
 * is unsure about, should still produce a usable row rather than being discarded
 * and retried. Every field has a default, and the enums repair common variants
 * (case, spacing, synonyms) before validation.
 */
export const ExtractionSchema = z.object({
  kind: z.enum(KINDS).catch("general_notice"),
  class_type: z
    .enum(["theory", "speed", "extra", "revision", "paper", "booster", "seminar", "other"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  subject: z
    .enum(["combined_maths", "physics", "other"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  headline: z.string().catch("").transform((v) => String(v).slice(0, 200)),
  detail: z.string().catch("").transform((v) => String(v).slice(0, 2000)),
  action: z.string().nullish().catch(null).transform((v) => (v ? String(v) : null)),
  urgency: z.enum(["critical", "high", "normal", "low"]).catch("normal"),
  status_change: z
    .enum(["scheduled", "postponed", "cancelled", "rescheduled", "started", "completed"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  event_date: z
    .string()
    .nullish()
    .catch(null)
    .transform((v) => (v ? normaliseDate(v) : null)),
  event_time: z
    .string()
    .nullish()
    .catch(null)
    .transform((v) => (v ? normaliseTime(v) : null)),
  event_end_time: z
    .string()
    .nullish()
    .catch(null)
    .transform((v) => (v ? normaliseTime(v) : null)),
  is_full_syllabus: z.boolean().nullish().catch(false).transform((v) => Boolean(v)),
  // A physics theory post is usually about which questions to do from which
  // tute, and names the booster episode it belongs to. That is study-planning
  // data rather than a class event, so it is captured separately.
  tute_name: z
    .string()
    .nullish()
    .catch(null)
    .transform((v) => (v ? String(v).trim().slice(0, 80) : null)),
  /**
   * The individual question numbers.
   *
   * Deliberately a list and not a start/end pair: teachers pick questions from
   * across the chapter, so "Q - 22,27,30,31,35" is five separate questions, not
   * a range. A range would tell the student to attempt eighteen questions and
   * silently drop four they never set.
   */
  question_numbers: z
    .array(z.coerce.number().int())
    .nullish()
    .catch(null)
    .transform((v) => {
      if (!Array.isArray(v)) return null;
      const nums = [...new Set(v.filter((n: unknown) => Number.isFinite(n) && Number(n) > 0))] as number[];
      nums.sort((a, b) => a - b);
      return nums.length ? nums.slice(0, 200) : null;
    }),
  question_count: z.coerce.number().int().nullish().catch(null).transform(numOrNull),
  booster_kind: z
    .enum(["speed", "theory", "other"])
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  booster_episode: z.coerce.number().int().nullish().catch(null).transform(numOrNull),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
});

/**
 * Coerce a question or episode number, or null.
 *
 * Zero is treated as "not stated": a model that has no answer often emits 0
 * rather than null, and "episode 0" or "0 questions" is not something a teacher
 * writes. Storing the 0 would show up as a real, wrong plan.
 */
function numOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export type Extraction = z.infer<typeof ExtractionSchema>;

/* ------------------------------------------------------- value normalisers */

function normaliseDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  const iso = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  // Bare "28-09" or "28/09" — assume the current year.
  const short = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (short) {
    return `${new Date().getUTCFullYear()}-${short[2].padStart(2, "0")}-${short[1].padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function normaliseTime(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[:.h](\d{2})/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const pm = /\bpm\b/i.test(s) || /\bරෑ|සවස/i.test(s);
  const am = /\bam\b/i.test(s) || /\bඋදේ|බයම|නිල්/i.test(s);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const KIND_HELP = `class_announcement = announces a class with date/time
class_reminder = reminds about an already-known class
postponement = class moved to another day
cancellation = class will not happen
time_change = same day, different time
live_now = class is starting right now
join_link = a Zoom/Meet/Telegram invite link
recording = YouTube recording or premiere link
material = notes, PDF, sheet, drive file
paper = a paper to attempt
test = spot test / morning test / quiz
booster = evening booster / program online discussion session
question_set = questions posted for discussion
result = marks/answer key
fee_notice = payment or registration
general_notice = announcement not tied to a specific class
chat = ordinary conversation, jokes, thanks
reaction = emoji or reaction only
irrelevant = promo for something unrelated to the student's classes`;

/** The physics theory channel posts study-planning data, not class events. */
const TUTE_GUIDE = `
Physics theory posts (the daily ones) usually are NOT a new class announcement. They say which
questions to work from which tute, how many, and which booster episode they belong to. For those:

- class_type = "theory" only when the post really is about a class happening.
- tute_name = the tute's topic name, in English, e.g. "Sound Intensity", "Motion in a Straight Line".
  Write the topic, NOT the tute's own number and never the episode number. "Tute 307" and "EB (307)"
  are both wrong: the first confuses the tute with the episode, the second copies the episode.
  If the post only names a number and no topic, leave tute_name null.
- question_numbers = EVERY question number the teacher listed, as a list of integers. They are
  chosen from across the chapter and are never contiguous, so this is a list and never a range.
  Given "Q - 22,27,30,31,32,33,35,37,40,41,44,46,47,59" the answer is exactly those fourteen
  numbers, sorted. Do not return [22, 59], and do not return a range object.
  If the post names a section instead of numbers, or no questions at all, return null.
- question_count = how many questions to do. If the post lists numbers, this is simply how many
  there are. Only use a number the teacher wrote when the questions themselves are not listed.
- booster_kind = "speed" or "theory" — which booster series the episode belongs to. A post about
  "speed" material is speed; "theory" is theory. Use "other" if neither is implied.
- booster_episode = the booster episode the post names. The common forms are all the same number:
  "EB (307)", "EP 307", "ep - 307", "Booster 307", "කොටස 307", "Speed Ep 05". Take the number that
  sits next to the words episode, ep, EB, booster, or කොටස.
  Do not confuse it with a tute number ("Tute 03" is a tute) or with a question number. If the post
  mentions no episode, return null.
- event_date / event_time = null unless the post actually names a day and time.

A physics "speed class" is a real, separate class. When a post announces one, class_type = "speed".`;

export function buildSystemPrompt(ctx: {
  channelTitle: string;
  channelKind: string;
  subject: string;
  nowColombo: string;
}): string {
  return `You are the analysis engine for "TheToDo", an app that helps Sri Lankan A/L students who take Sinhala-medium online tuition classes. Teachers post 20-30 Telegram messages a day in Sinhala, English, or a mix, and the student needs every message turned into a clear English summary and an accurate schedule.

Telegram channel context:
- Channel: ${ctx.channelTitle}
- Channel type: ${ctx.channelKind}
- Subject: ${ctx.subject}
- Current date/time in Colombo, Sri Lanka (UTC+5:30): ${ctx.nowColombo}

Your job: read ONE Telegram message and return structured JSON.

How to read the messages:
- Most text is Sinhala script, often with English and Singlish mixed in. Read it all.
- "අද" / "today" means the message's own date. "හෙට" / "තෙනසුම්දා" / "tomorrow" means the next day. Weekday names: ඉරිදා=Sunday, සඳුදා=Monday, අඟහරුවාදා=Tuesday, බදාදා=Wednesday, බ්‍රහස්පතින්දා=Thursday, සිකුරාදා=Friday, සෙනසුරාදා=Saturday.
- Times like "උදේ 8.00" = 08:00, "සවස 1.30" = 13:30, "රෑ 8.00" = 20:00. Convert to 24h HH:MM.
- Teachers reschedule often. A message that moves a class to another day is status_change="rescheduled" (or "postponed" if no new date is given), and event_date must carry the NEW date.
- A paper/PDF posted for students to attempt BEFORE a class is kind="paper" or "test", and the action must say to do it before the class.
- Evening "booster" / "program online" sessions where selected questions are discussed are kind="booster".
- Messages that are promo for an unrelated event (e.g. a physical seminar in Anuradhapura the student does not attend) are kind="irrelevant", class_type null, event_date null.
- Reactions, emoji-only posts, and casual chat are kind="reaction" or "chat".

kind values: ${KIND_HELP}
class_type values: theory | speed | extra | revision | paper | booster | seminar | other
${TUTE_GUIDE}
Rules:
- Always answer in ENGLISH for headline, detail and action, even when the message is Sinhala.
- detail must be specific enough to act on: which subject, which class type, which day, which time, what to bring or do.
- If the message states no date, still set event_date to the message's own date when it clearly refers to "today" or an imminent class.
- If the message announces a full-syllabus A/L paper, set is_full_syllabus=true.
- Do not invent dates or times. Use null when genuinely absent.
- Every field must be present. Never omit a key.
- CRITICAL OUTPUT RULE: your very first characters must be "{". Do not think out loud, do not explain, do not restate the message. Emit the single JSON object and nothing else.`;
}

export function buildUserPrompt(input: {
  text: string;
  hasMedia: boolean;
  mediaName: string | null;
  mediaKind?: string | null;
  /** Text read from a PDF on this machine. Only ever a short excerpt. */
  attachmentExcerpt?: string | null;
  isForwarded: boolean;
  forwardFrom: string | null;
  messageDate: string;
  hints: RuleHints;
}): string {
  const lines: string[] = [];
  lines.push(`Message sent at (Colombo): ${input.messageDate}`);
  if (input.forwardFrom) lines.push(`Forwarded from: ${input.forwardFrom}`);

  // Media is never sent to the model. A file's *name* is worth a line because
  // "paper 02.pdf" often says what the caption does not; its contents are not
  // attached, and an image is not even described beyond the fact it exists.
  if (input.hasMedia) {
    const kind = input.mediaKind ?? "file";
    lines.push(
      `Attached ${kind}: ${input.mediaName ?? "(unnamed file)"}` +
        (/pdf|docx?|xlsx?$/i.test(input.mediaName ?? "") ? " — a document" : ""),
    );
    if (kind === "photo" || kind === "image") {
      lines.push("(image contents were not sent; judge this message from its caption only)");
    }
  }

  if (input.attachmentExcerpt) {
    lines.push("");
    lines.push("--- TEXT READ FROM THE ATTACHED DOCUMENT (on this machine, not sent as a file) ---");
    lines.push(input.attachmentExcerpt);
    lines.push("--- END DOCUMENT ---");
    lines.push(
      "Use this to understand what the document is, e.g. which paper or question set. Do not repeat it in detail.",
    );
    lines.push("");
  }

  const h = input.hints;
  lines.push(
    `Detector hints: hasLink=${h.hasLink} hasZoom=${h.hasZoom} hasYouTube=${h.hasYouTube} hasTime=${h.hasTime} hasDate=${h.hasDate} looksPostponed=${h.looksPostponed} looksLikeClass=${h.looksLikeClass} sinhalaRatio=${h.sinhalaRatio.toFixed(2)}`,
  );
  lines.push("");
  lines.push("--- MESSAGE ---");
  lines.push(input.text || "(no caption text; see the document above if there is one)");
  lines.push("--- END ---");
  lines.push("");
  lines.push("Return the JSON object now.");
  return lines.join("\n");
}

/** Pull the last balanced JSON object out of a model response. */
function findJsonObject(raw: string): string | null {
  // Strip a fenced block if present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fence ? fence[1] : raw;

  // Scan for every balanced {...} and keep the last one that parses. Reasoning
  // models emit prose and sometimes their own brace-laden scratch JSON first.
  let best: string | null = null;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start >= 0) {
          const slice = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(slice);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) best = slice;
          } catch {
            /* keep scanning */
          }
          start = -1;
        }
      }
    }
  }
  return best;
}

/** Tolerate any provider: strips prose, repairs nothing, validates leniently. */
export function parseExtraction(raw: string): Extraction {
  const candidate = findJsonObject(raw);
  if (!candidate) {
    throw new Error(`Model returned no JSON object. Response began: ${raw.slice(0, 240)}`);
  }
  const parsed = ExtractionSchema.safeParse(JSON.parse(candidate));
  if (!parsed.success) {
    throw new Error(
      `Model JSON failed validation: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return parsed.data;
}

export const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const ACTIONABLE_KINDS: MessageKind[] = [
  "class_announcement",
  "class_reminder",
  "postponement",
  "cancellation",
  "time_change",
  "live_now",
  "join_link",
  "recording",
  "material",
  "paper",
  "test",
  "booster",
  "question_set",
];

export const SCHEDULE_KINDS: MessageKind[] = [
  "class_announcement",
  "class_reminder",
  "postponement",
  "cancellation",
  "time_change",
  "live_now",
  "booster",
];

export function kindToTaskKind(kind: MessageKind): string | null {
  switch (kind) {
    case "paper":
      return "paper";
    case "test":
      return "test";
    case "recording":
      return "video";
    case "join_link":
    case "live_now":
      return "attend";
    case "material":
      return "download";
    case "question_set":
      return "read";
    default:
      return null;
  }
}

export type { ClassType, MessageKind, StatusChange, Urgency };
