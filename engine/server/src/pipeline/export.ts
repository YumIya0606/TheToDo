import { db } from "../db/index.js";
import type { ClassEvent } from "../../../../shared/types.js";
import { listEventSources, listLinksForEvent } from "./project.js";
import { todayColombo, shiftDate } from "../ai/engine.js";

/**
 * The schedule, as data another program can read.
 *
 * This is the hand-off point to the planner app: it deliberately contains no
 * UI-specific fields, and every date is an absolute ISO date rather than a day
 * offset, so a consumer never has to re-derive a date. Alt-week classes are
 * expressed by their actual occurrences, not by a weekly rule, because a
 * fortnightly pattern cannot be trusted to stay regular.
 */

export interface ExportEvent {
  id: number;
  subject: string;
  classType: string;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  isFullSyllabus: boolean;
  note: string;
  action: string | null;
  urgency: string;
  confidence: number;
  links: Array<{ url: string; kind: string; label: string }>;
  sources: Array<{
    channel: string;
    channelTitle: string;
    messageId: number;
    postedAt: number;
    headline: string | null;
    original: string;
  }>;
}

export interface ExportBooster {
  kind: string;
  episode: number | null;
  tute: string | null;
  /** The exact questions to do. Not a range: they are picked from across the chapter. */
  questions: number[];
  questionCount: number | null;
  postedAt: number;
  channel: string;
  headline: string | null;
  original: string;
}

export interface ScheduleExport {
  generatedAt: number;
  generatedAtIso: string;
  timezone: string;
  range: { from: string; to: string };
  counts: {
    events: number;
    upcoming: number;
    boosterPosts: number;
    links: number;
    messages: number;
    understood: number;
  };
  events: ExportEvent[];
  /** Daily physics-theory study plans, newest first. */
  boosterPlan: ExportBooster[];
  /** Classes the teacher has not confirmed anything about recently. */
  notes: string[];
}

/** Monday of the current week, in Colombo terms. */
function startOfWeekColombo(): string {
  const today = todayColombo();
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const shift = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

function toEvent(e: ClassEvent): ExportEvent {  const sources = listEventSources(e.id);
  return {
    id: e.id,
    subject: e.subject,
    classType: e.class_type,
    title: e.title,
    date: e.event_date,
    startTime: e.event_time,
    endTime: e.event_end_time,
    status: e.status,
    isFullSyllabus: e.is_full_syllabus === 1,
    note: e.note,
    action: e.action,
    urgency: e.urgency,
    confidence: e.confidence,
    links: listLinksForEvent(e.id).map((l) => ({ url: l.url, kind: l.kind, label: l.label })),
    sources: sources.map((s) => ({
      channel: s.username,
      channelTitle: s.channel_title,
      messageId: s.message_id,
      postedAt: s.date,
      headline: s.headline,
      original: s.text,
    })),
  };
}

/**
 * Build the export.
 *
 * `from` defaults to the start of the current week rather than a fortnight
 * back. The student only needs this week onward: a class they already attended
 * is history, and re-reading months of channel noise is what burns the free
 * daily quota. The one exception is a class that is still marked as upcoming.
 */
export function buildScheduleExport(days = 21, from?: string): ScheduleExport {
  const start = from ?? startOfWeekColombo();
  const end = shiftDate(todayColombo(), days);

  const events = (
    db
      .prepare(
        `SELECT * FROM events
         WHERE event_date IS NOT NULL AND event_date >= ? AND event_date <= ?
           AND status != 'cancelled'
         ORDER BY event_date ASC, COALESCE(event_time,'23:59') ASC`,
      )
      .all(start, end) as ClassEvent[]
  ).map(toEvent);

  const boosterPlan = (
    db
      .prepare(
        `SELECT a.booster_kind, a.booster_episode, a.tute_name, a.question_numbers,
                a.question_count, a.headline, m.date, m.text, c.username
         FROM analysis a
         JOIN messages m ON m.id = a.message_id
         JOIN channels c ON c.id = m.channel_id
         WHERE a.provider != 'error'
           AND (a.booster_episode IS NOT NULL OR a.tute_name IS NOT NULL OR a.question_count IS NOT NULL)
           AND m.date >= ?
         ORDER BY m.date DESC
         LIMIT 400`,
      )
      .all(new Date(start + "T00:00:00+05:30").getTime() / 1000) as any[]
  ).map((r) => {
    // The question list is authoritative. There is deliberately no fallback to
    // an old start/end pair: those columns were replaced rather than kept, so a
    // fallback to them could never fire and would only be a lie about what an
    // older database can still tell us.
    let questions: number[] = [];
    try {
      const parsed = r.question_numbers ? JSON.parse(r.question_numbers) : null;
      if (Array.isArray(parsed)) questions = parsed.filter((n: unknown) => Number.isFinite(n));
    } catch {
      questions = [];
    }
    return {
      kind: r.booster_kind ?? "unknown",
      episode: r.booster_episode,
      tute: r.tute_name,
      questions,
      questionCount: r.question_count ?? (questions.length || null),
      postedAt: r.date,
      channel: r.username,
      headline: r.headline,
      original: String(r.text ?? "").replace(/\s+/g, " ").slice(0, 400),
    };
  });

  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM messages) AS messages,
         (SELECT COUNT(*) FROM analysis WHERE provider NOT IN ('rules','laya','error')) AS understood,
         (SELECT COUNT(*) FROM links) AS links`,
    )
    .get() as { messages: number; understood: number; links: number };

  return {
    generatedAt: Date.now(),
    generatedAtIso: new Date().toISOString(),
    timezone: "Asia/Colombo",
    range: { from: start, to: end },
    counts: {
      events: events.length,
      upcoming: events.filter((e) => (e.date ?? "") >= todayColombo()).length,
      boosterPosts: boosterPlan.length,
      links: counts.links,
      messages: counts.messages,
      understood: counts.understood,
    },
    events,
    boosterPlan,
    notes: [
      "Dates are absolute ISO dates. Times are HH:MM 24-hour, Asia/Colombo.",
      "Only classes that were actually announced appear here; recurring commitments the student keeps in their own planner are not repeated.",
      "status is one of scheduled, rescheduled, postponed, started, completed.",
      "boosterPlan is the physics theory channel's daily 'which questions, which tute' posts, newest first.",
    ],
  };
}
