import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/stores/settingsStore';
import type { StudyPointer } from '@/stores/boosterStore';

/**
 * The shape ClassRadar writes to schedule.json.
 *
 * Kept as a hand-written type rather than shared code: the two apps are separate
 * programs that happen to agree on a file format, and each side owning its own
 * copy is what lets either one change without breaking the other.
 */
export interface RadarEvent {
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

export interface RadarBooster {
  kind: string;
  episode: number | null;
  tute: string | null;
  /** The exact questions to do. Chosen from across the chapter, so not a range. */
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
  events: RadarEvent[];
  boosterPlan: RadarBooster[];
  notes: string[];
}

export interface LoadResult {
  ok: boolean;
  data: ScheduleExport | null;
  error: string | null;
  path: string;
}

/** The path to try when the student has not set one. */
export async function defaultSchedulePath(): Promise<string> {
  try {
    return await invoke<string>('classradar_default_path');
  } catch {
    return '';
  }
}

/**
 * Read the schedule export.
 *
 * Never throws: a missing or unreadable file is a normal state (ClassRadar may
 * simply not have been run), so the caller gets a result it can render rather
 * than an exception to handle.
 */
export async function loadSchedule(force = false): Promise<LoadResult> {
  const configured = useSettingsStore.getState().classRadarPath;
  const path = configured || (await defaultSchedulePath());

  if (!path) {
    return {
      ok: false,
      data: null,
      error: 'Could not work out where ClassRadar stores its data.',
      path: '',
    };
  }

  try {
    const text = await invoke<string>('read_classradar_schedule', { exportPath: path });
    const data = JSON.parse(text) as ScheduleExport;
    if (!data || !Array.isArray(data.events)) {
      return { ok: false, data: null, error: 'That file is not a ClassRadar schedule.', path };
    }
    if (!force) useSettingsStore.getState().markClassRadarChecked();
    return { ok: true, data, error: null, path };
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: e instanceof Error ? e.message : String(e),
      path,
    };
  }
}

/* ── Formatting helpers shared with the view ─────────────────────────────── */

export function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

export function fmtTime(time: string | null): string {
  const mins = toMinutes(time);
  if (mins == null) return '—';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** ClassRadar omits an end time as often as not, so fall back to a typical length. */
export function fmtRange(event: RadarEvent): string {
  const start = fmtTime(event.startTime);
  if (!event.startTime) return '—';
  if (!event.endTime) return start;
  return `${start} – ${fmtTime(event.endTime)}`;
}

export function isUpcoming(event: RadarEvent, today: string): boolean {
  return (event.date ?? '') >= today && event.status !== 'cancelled' && event.status !== 'completed';
}

export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtDate(iso: string | null): string {
  if (!iso) return 'No date';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}`;
}

/** Map a ClassRadar subject to the planner's subject names so the two agree. */
export function toPlannerSubject(subject: string): string {
  switch (subject) {
    case 'combined_maths':
      return 'Combined Maths';
    case 'physics':
      return 'AL Physics';
    case 'chemistry':
      return 'AL Chemistry';
    default:
      return 'General English';
  }
}

/**
 * The most recent study-plan post, as the booster tracker's pointer.
 *
 * Only the newest post is carried: the student works through the plan in order,
 * and a list of every past post would be noise on the boost screen.
 */
export function toStudyPointer(plan: RadarBooster[]): StudyPointer | null {  const latest = [...plan].sort((a, b) => b.postedAt - a.postedAt)[0];
  if (!latest) return null;
  return {
    kind: latest.kind === 'speed' || latest.kind === 'theory' ? latest.kind : 'other',
    episode: latest.episode ?? null,
    tute: latest.tute ?? null,
    questions: Array.isArray(latest.questions) ? latest.questions : [],
    questionCount: latest.questionCount ?? latest.questions?.length ?? null,
    postedAt: latest.postedAt,
    headline: latest.headline ?? null,
    original: latest.original ?? '',
  };
}
