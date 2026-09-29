import { useTaskStore } from '@/stores/taskStore';
import type { Task } from '@/types';
import type { RadarEvent } from '@/lib/classRadar';
import { toPlannerSubject } from '@/lib/classRadar';

/**
 * Turning channel readings into things you actually do.
 *
 * A paper announced for Saturday is only useful if it is in the task list with
 * the date on it, so that the existing due-soon logic, the dashboard counts and
 * the reminders all pick it up. Anything with a date and something to do becomes
 * a task; an announcement with neither stays in the schedule.
 */

export interface TaskDraft {
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  subject: string;
  tags: string[];
}

/** Does this reading actually ask something of the student? */
export function toTaskDraft(event: RadarEvent): TaskDraft | null {
  if (!event.date) return null;
  if (event.status === 'cancelled' || event.status === 'completed') return null;

  const isWork =
    Boolean(event.action) ||
    event.isFullSyllabus ||
    /\b(paper|test|attempt|submit|practise|practice|revise|watch|complete)\b/i.test(
      `${event.title} ${event.action ?? ''}`
    );

  if (!isWork) return null;

  const subject = toPlannerSubject(event.subject);
  const title = event.action ? `${event.title} — ${event.action}` : event.title;

  return {
    title: title.slice(0, 120),
    description: [event.note, event.links.map((l) => l.url).join('\n')]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 1000),
    dueDate: event.date,
    dueTime: event.startTime ?? null,
    subject,
    tags: ['class', event.classType, event.isFullSyllabus ? 'full-syllabus' : 'normal'].filter(
      Boolean
    ) as string[],
  };
}

/** A stable key so the same reading never becomes two tasks. */
function fingerprint(title: string, date: string): string {
  return `${title.trim().toLowerCase().slice(0, 60)}|${date}`;
}

export function existingFingerprints(tasks: Task[]): Set<string> {
  return new Set(
    tasks
      .filter((t) => (t.tags ?? []).includes('class'))
      .map((t) => fingerprint(t.title, t.dueDate ?? ''))
  );
}

export interface ImportResult {
  created: number;
  skipped: number;
  drafts: TaskDraft[];
}

export function draftsFromEvents(events: RadarEvent[], tasks: Task[]): TaskDraft[] {
  const seen = existingFingerprints(tasks);
  const out: TaskDraft[] = [];
  for (const e of events) {
    const draft = toTaskDraft(e);
    if (!draft) continue;
    const key = fingerprint(draft.title, draft.dueDate ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(draft);
  }
  return out;
}

/** Write the drafts into the task store. */
export function commitDrafts(drafts: TaskDraft[]): number {
  const addTask = useTaskStore.getState().addTask;
  let n = 0;
  for (const d of drafts) {
    addTask({
      title: d.title,
      description: d.description,
      dueDate: d.dueDate ?? undefined,
      dueTime: d.dueTime ?? undefined,
      isScheduled: Boolean(d.dueTime),
      status: 'todo',
      category: d.subject,
      tags: d.tags,
      priority: 'high',
    });
    n++;
  }
  return n;
}
