import { db } from "../db/index.js";
import type { ClassEvent, EventSource, Link, StatusChange } from "../../../../shared/types.js";
import { shiftDate, todayColombo } from "../ai/engine.js";
import { ACTIONABLE_KINDS, kindToTaskKind, SCHEDULE_KINDS } from "../ai/prompt.js";

/**
 * Turns per-message analysis rows into the three things the student actually
 * cares about: a class calendar, a list of links, and a to-do list.
 * Re-runnable: projecting twice from the same analysis is a no-op.
 */

const SCHEDULE_STATUS: Record<string, StatusChange> = {
  class_announcement: "scheduled",
  class_reminder: "scheduled",
  booster: "scheduled",
  live_now: "started",
  postponement: "postponed",
  cancellation: "cancelled",
  time_change: "rescheduled",
};

export interface ProjectionStats {
  events: number;
  links: number;
  tasks: number;
  rescheduled: number;
  cancelled: number;
}

export function projectAll(): ProjectionStats {
  const rows = db
    .prepare(
      `SELECT m.id AS message_id, m.date, m.text, m.media_name,
              c.subject AS channel_subject, c.kind AS channel_kind,
              a.*
       FROM analysis a
       JOIN messages m ON m.id = a.message_id
       JOIN channels c ON c.id = m.channel_id
       WHERE a.provider != 'error'
         AND a.prompt_version = (SELECT MAX(prompt_version) FROM analysis a2 WHERE a2.message_id = a.message_id)
       ORDER BY m.date ASC`,
    )
    .all() as any[];

  const stats: ProjectionStats = { events: 0, links: 0, tasks: 0, rescheduled: 0, cancelled: 0 };
  const today = todayColombo();

  for (const r of rows) {
    const kind = r.kind as string;
    const subject = (r.subject ?? r.channel_subject ?? "other") as ClassEvent["subject"];
    const classType = (r.class_type ?? inferClassType(r.channel_kind)) as ClassEvent["class_type"];

    /* ------------------------------------------------------------ events */
    if (SCHEDULE_KINDS.includes(kind as never) && r.event_date) {
      const eventDate = r.event_date as string;
      const status = SCHEDULE_STATUS[kind] ?? "scheduled";

      if (status === "postponed") {
        const target = findOpenEvent(subject, classType, today);
        if (target) {
          db.prepare(
            "UPDATE events SET status = 'postponed', note = ?, updated_at = ? WHERE id = ?",
          ).run(
            `${trim(r.detail, 400)} — postponed as of ${eventDate}`.trim(),
            Date.now(),
            target.id,
          );
          addSource(target.id, r.message_id);
          stats.rescheduled++;
          continue;
        }
      }

      if (status === "cancelled") {
        const target = findOpenEvent(subject, classType, eventDate);
        if (target) {
          db.prepare(
            "UPDATE events SET status = 'cancelled', updated_at = ? WHERE id = ?",
          ).run(Date.now(), target.id);
          addSource(target.id, r.message_id);
          stats.cancelled++;
          continue;
        }
      }

      // New or amended class: upsert on (subject, class_type, date, time).
      const existing = findEvent(subject, classType, eventDate, (r.event_time as string) ?? null);
      if (existing) {
        db.prepare(
          `UPDATE events SET
             title = CASE WHEN length(@title) > 0 THEN @title ELSE title END,
             event_time = COALESCE(@time, event_time),
             event_end_time = COALESCE(@end, event_end_time),
             status = @status,
             action = COALESCE(@action, action),
             urgency = @urgency,
             note = @note,
             confidence = @conf,
             is_full_syllabus = @full,
             updated_at = @now
           WHERE id = @id`,
        ).run({
          id: existing.id,
          title: (r.headline ?? "").slice(0, 200),
          time: r.event_time,
          end: r.event_end_time,
          status,
          action: r.action,
          urgency: r.urgency ?? "normal",
          note: trim(r.detail, 800),
          conf: r.confidence ?? 0,
          full: (r.is_full_syllabus as number) ? 1 : 0,
          now: Date.now(),
        });
        addSource(existing.id, r.message_id);
      } else {
        const id = insertEvent({
          subject,
          classType,
          title: (r.headline ?? "").slice(0, 200) || `${classType} class`,
          eventDate,
          eventTime: r.event_time,
          eventEndTime: r.event_end_time,
          status,
          isFull: (r.is_full_syllabus as number) ? 1 : 0,
          note: trim(r.detail, 800),
          action: r.action,
          urgency: r.urgency ?? "normal",
          confidence: r.confidence ?? 0,
        });
        addSource(id, r.message_id);
        stats.events++;
      }
    }

    /* ------------------------------------------------------------- links */
    if (r.event_id) {
      db.prepare("UPDATE links SET event_id = ? WHERE message_id = ?").run(r.event_id, r.message_id);
    }
    const linkCount = (
      db.prepare("SELECT COUNT(*) AS n FROM links WHERE message_id = ?").get(r.message_id) as {
        n: number;
      }
    ).n;
    stats.links += linkCount;

    /* ------------------------------------------------------------- tasks */
    const taskKind = kindToTaskKind(kind as never);
    if (taskKind && ACTIONABLE_KINDS.includes(kind as never)) {
      const due = r.event_date ?? null;
      const exists = db
        .prepare("SELECT id FROM tasks WHERE message_id = ? AND kind = ?")
        .get(r.message_id, taskKind);
      if (!exists) {
        db.prepare(
          `INSERT INTO tasks (message_id, subject, kind, title, note, due_date, due_time, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(
          r.message_id,
          subject,
          taskKind,
          (r.headline || r.action || taskKind).slice(0, 200),
          trim(r.action ?? r.detail, 300),
          due,
          r.event_time ?? null,
          Date.now(),
        );
        stats.tasks++;
      }
    }

    db.prepare("UPDATE messages SET is_important = ? WHERE id = ?").run(
      isImportant(kind) ? 1 : 0,
      r.message_id,
    );
  }

  // Attach links to their newest event when the analysis produced one.
  attachLinksToEvents();
  return stats;
}

function isImportant(kind: string): boolean {
  return (
    kind === "postponement" ||
    kind === "cancellation" ||
    kind === "time_change" ||
    kind === "live_now" ||
    kind === "class_announcement" ||
    kind === "paper" ||
    kind === "test"
  );
}

function trim(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function inferClassType(channelKind: string): ClassEvent["class_type"] {
  switch (channelKind) {
    case "revision":
      return "revision";
    case "paper":
      return "paper";
    case "booster":
      return "booster";
    default:
      return "theory";
  }
}

interface EventRow {
  id: number;
  subject: string;
  class_type: string;
  event_date: string | null;
  event_time: string | null;
  status: string;
}

/**
 * Two different classes can legitimately run on the same day (an evening booster
 * and a 7pm paper, say), so the time is part of the identity. Collapsing on date
 * alone would silently delete one of them.
 */
function findEvent(
  subject: string,
  classType: string,
  date: string,
  time: string | null,
): EventRow | undefined {
  if (time) {
    const exact = db
      .prepare(
        `SELECT * FROM events
         WHERE subject = ? AND class_type = ? AND event_date = ? AND event_time = ?
         ORDER BY created_at ASC LIMIT 1`,
      )
      .get(subject, classType, date, time) as EventRow | undefined;
    if (exact) return exact;
  }
  return db
    .prepare(
      `SELECT * FROM events
       WHERE subject = ? AND class_type = ? AND event_date = ?
         AND status IN ('scheduled','rescheduled','started')
       ORDER BY COALESCE(event_time,'23:59') ASC LIMIT 1`,
    )
    .get(subject, classType, date) as EventRow | undefined;
}

/** The next still-open class of this type, to apply a postponement to. */
function findOpenEvent(
  subject: string,
  classType: string,
  fromDate: string,
): EventRow | undefined {
  return db
    .prepare(
      `SELECT * FROM events
       WHERE subject = ? AND class_type = ? AND event_date >= ?
         AND status IN ('scheduled','rescheduled','started')
       ORDER BY event_date ASC, event_time ASC LIMIT 1`,
    )
    .get(subject, classType, fromDate) as EventRow | undefined;
}

function insertEvent(e: {
  subject: string;
  classType: string;
  title: string;
  eventDate: string | null;
  eventTime: string | null;
  eventEndTime: string | null;
  status: string;
  isFull: number;
  note: string;
  action: string | null;
  urgency: string;
  confidence: number;
}): number {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO events
        (subject, class_type, title, event_date, event_time, event_end_time, status,
         is_full_syllabus, is_exam_style, note, action, urgency, confidence, created_at, updated_at)
       VALUES (@subject,@classType,@title,@eventDate,@eventTime,@eventEndTime,@status,
         @isFull,0,@note,@action,@urgency,@confidence,@now,@now)`,
    )
    .run({ ...e, now });
  return Number(info.lastInsertRowid);
}

function addSource(eventId: number, messageId: number): void {
  db.prepare(
    "INSERT OR IGNORE INTO event_sources (event_id, message_id) VALUES (?, ?)",
  ).run(eventId, messageId);
}

/** Link each message's links to the event that message produced or updated. */
function attachLinksToEvents(): void {
  db.prepare(
    `UPDATE links SET event_id = (
        SELECT es.event_id FROM event_sources es
        JOIN events e ON e.id = es.event_id
        WHERE es.message_id = links.message_id
        ORDER BY e.updated_at DESC LIMIT 1
     )
     WHERE event_id IS NULL`,
  ).run();
}

/* ------------------------------------------------------------------ reads */

export function listEvents(opts: {
  from?: string;
  to?: string;
  subject?: string;
  classType?: string;
  status?: string;
  limit?: number;
}): ClassEvent[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.from) {
    where.push("(e.event_date IS NULL OR e.event_date >= @from)");
    params.from = opts.from;
  }
  if (opts.to) {
    where.push("(e.event_date IS NULL OR e.event_date <= @to)");
    params.to = opts.to;
  }
  if (opts.subject && opts.subject !== "all") {
    where.push("e.subject = @subject");
    params.subject = opts.subject;
  }
  if (opts.classType && opts.classType !== "all") {
    where.push("e.class_type = @classType");
    params.classType = opts.classType;
  }
  if (opts.status && opts.status !== "all") {
    where.push("e.status = @status");
    params.status = opts.status;
  }
  params.limit = opts.limit ?? 500;

  return db
    .prepare(
      `SELECT e.* FROM events e
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY COALESCE(e.event_date,'9999-12-31') ASC,
                COALESCE(e.event_time,'23:59') ASC,
                e.urgency ASC
       LIMIT @limit`,
    )
    .all(params) as ClassEvent[];
}

export function getEvent(id: number): ClassEvent | null {
  const ev = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as ClassEvent | null;
  if (!ev) return null;
  ev.links = listLinksForEvent(id);
  ev.sources = listEventSources(id);
  return ev;
}

export function listLinksForEvent(eventId: number): Link[] {
  return db.prepare("SELECT * FROM links WHERE event_id = ? ORDER BY id").all(eventId) as Link[];
}

export function listEventSources(eventId: number): EventSource[] {
  return db
    .prepare(
      `SELECT es.event_id, es.message_id, m.msg_id, m.channel_id, c.username, c.title AS channel_title,
              m.date, m.text, a.kind, a.headline, a.detail, a.status_change
       FROM event_sources es
       JOIN messages m ON m.id = es.message_id
       JOIN channels c ON c.id = m.channel_id
       LEFT JOIN analysis a ON a.message_id = m.id
       WHERE es.event_id = ?
       ORDER BY m.date DESC`,
    )
    .all(eventId) as EventSource[];
}

export function eventsOn(date: string, subject?: string): ClassEvent[] {
  return listEvents({ from: date, to: date, subject, limit: 100 });
}

export { shiftDate };
