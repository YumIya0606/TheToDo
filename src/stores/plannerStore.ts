import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Commitment, StudyReminder } from '@/types';
import { seedCommitments } from '@/lib/seedTimetable';

/**
 * Study Planner state.
 *
 * The user (an A/L maths-stream student) logs the recurring blocks that occupy
 * their week — school, tuition classes, sleep — and the planner derives how much
 * free time remains, then splits it across their subjects (weak subjects get a
 * bigger share). Studied time is read from `focusStore.studyAnalytics` so the
 * planner and Focus Mode stay in sync.
 */

/** Subjects must match focusStore's names so analytics join cleanly. */
export const PLANNER_SUBJECTS = [
  'Combined Maths',
  'AL Physics',
  'AL Chemistry',
  'General English',
] as const;

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const FULL_DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Portion of free time actually allocated to study (the rest is meals/rest/buffer). */
const DEFAULT_STUDY_RATIO = 0.8;

/** Weak subjects are weighted double. */
const WEAK_WEIGHT = 2;

interface PlannerState {
  commitments: Commitment[];
  reminders: StudyReminder[];
  enabledSubjects: string[];
  weakSubjects: string[];
  studyRatio: number;
  onboarded: boolean;

  addCommitment: (c: Omit<Commitment, 'id'>) => void;
  updateCommitment: (id: string, updates: Partial<Commitment>) => void;
  removeCommitment: (id: string) => void;

  addReminder: (r: Omit<StudyReminder, 'id'>) => void;
  removeReminder: (id: string) => void;
  markReminderFired: (id: string, dateKey: string) => void;

  toggleSubject: (subject: string) => void;
  toggleWeak: (subject: string) => void;
  setStudyRatio: (ratio: number) => void;
  setOnboarded: (v: boolean) => void;

  /** Load the student's real timetable. Only offered on an empty planner. */
  seedTimetable: () => void;
  /** Weeks the student is on an off-week for a fortnightly class. */
  toggleOffThisWeek: (id: string) => void;
}

const genId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      commitments: [],
      reminders: [],
      enabledSubjects: ['Combined Maths', 'AL Physics', 'AL Chemistry'],
      weakSubjects: [],
      studyRatio: DEFAULT_STUDY_RATIO,
      onboarded: false,

      addCommitment: (c) => set((s) => ({ commitments: [...s.commitments, { ...c, id: genId() }] })),
      updateCommitment: (id, updates) => set((s) => ({
        commitments: s.commitments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
      removeCommitment: (id) => set((s) => ({ commitments: s.commitments.filter((c) => c.id !== id) })),

      addReminder: (r) => set((s) => ({ reminders: [...s.reminders, { ...r, id: genId() }] })),
      removeReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      markReminderFired: (id, dateKey) => set((s) => ({
        reminders: s.reminders.map((r) => (r.id === id ? { ...r, lastFiredDate: dateKey } : r)),
      })),

      toggleSubject: (subject) => set((s) => {
        const on = s.enabledSubjects.includes(subject);
        return {
          enabledSubjects: on
            ? s.enabledSubjects.filter((x) => x !== subject)
            : [...s.enabledSubjects, subject],
          weakSubjects: on ? s.weakSubjects.filter((x) => x !== subject) : s.weakSubjects,
        };
      }),

      toggleWeak: (subject) => set((s) => {
        const weak = s.weakSubjects.includes(subject);
        return { weakSubjects: weak ? s.weakSubjects.filter((x) => x !== subject) : [...s.weakSubjects, subject] };
      }),

      setStudyRatio: (ratio) => set({ studyRatio: Math.min(1, Math.max(0.1, ratio)) }),
      setOnboarded: (v) => set({ onboarded: v }),

      /**
       * Load the student's real timetable.
       *
       * Additive, not all-or-nothing: only blocks whose label is not already
       * present are added, so this is safe to offer on a planner that already has
       * commitments and never overwrites something edited by hand.
       */
      seedTimetable: () =>
        set((s) => {
          if (s.onboarded && s.commitments.length > 0) {
            const have = new Set(s.commitments.map((c) => c.label.trim().toLowerCase()));
            const additions = seedCommitments(genId).filter(
              (c) => !have.has(c.label.trim().toLowerCase())
            );
            if (additions.length === 0) return {};
            return { commitments: [...s.commitments, ...additions], onboarded: true };
          }
          return { commitments: seedCommitments(genId), onboarded: true };
        }),

      toggleOffThisWeek: (id) =>
        set((s) => ({
          commitments: s.commitments.map((c) =>
            c.id === id ? { ...c, offThisWeek: !c.offThisWeek } : c
          ),
        })),
    }),
    { name: 'thetodo-planner-storage' }
  )
);

/* ── Derived helpers (pure) ─────────────────────────────────────────────── */

/** Monday-based week index, so "week 0" is stable across years for a given anchor. */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - shift);
  return d;
}

/** Whole weeks between two dates, counted from a Monday boundary. */
function weeksBetween(from: Date, to: Date): number {
  return Math.round((mondayOf(to).getTime() - mondayOf(from).getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Is a commitment active on a given date?
 *
 * A fortnightly class is on for the week containing its anchor and every second
 * week after. `offThisWeek` is a deliberate one-week override, because the
 * student often knows this week is the break before the anchor is reached.
 * Anything without a cadence is weekly, which is what all pre-existing saved
 * data means.
 */
export function isCommitmentActiveOn(c: Commitment, date: Date): boolean {
  if (c.offThisWeek && todayKey() === toDateKey(date)) return false;
  if (c.cadence !== 'fortnightly') return true;
  if (!c.anchorDate) return true; // no anchor yet: assume the current week is on
  const anchor = new Date(`${c.anchorDate}T00:00:00`);
  if (Number.isNaN(anchor.getTime())) return true;
  const delta = weeksBetween(anchor, date);
  return ((delta % 2) + 2) % 2 === 0;
}

export function toDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Duration in minutes; handles overnight blocks (end before start → wraps past midnight). */
export function commitmentDuration(c: { startTime: string; endTime: string }): number {
  let dur = toMinutes(c.endTime) - toMinutes(c.startTime);
  if (dur <= 0) dur += 24 * 60;
  return dur;
}

/** Commitments for a weekday, optionally filtered by whether they fall in this week. */
export function dayCommitments(
  commitments: Commitment[],
  dayOfWeek: number,
  date?: Date
): Commitment[] {
  return commitments.filter(
    (c) => c.days.includes(dayOfWeek) && (!date || isCommitmentActiveOn(c, date))
  );
}

/** Free minutes in a day = 1440 − everything occupied that day. */
export function freeMinutesForDay(
  commitments: Commitment[],
  dayOfWeek: number,
  date?: Date
): number {
  const used = dayCommitments(commitments, dayOfWeek, date).reduce(
    (sum, c) => sum + commitmentDuration(c),
    0
  );
  return Math.max(0, 24 * 60 - used);
}

export interface SubjectAllocation {
  name: string;
  weight: number;
  minutes: number;
}

/**
 * Split the day's study budget across enabled subjects.
 * Base split is equal; weak subjects take a double share.
 */
export function allocateSubjects(
  freeMin: number,
  enabled: string[],
  weak: string[],
  studyRatio: number
): SubjectAllocation[] {
  const budget = Math.round(freeMin * studyRatio);
  const weights = enabled.map((s) => (weak.includes(s) ? WEAK_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return enabled.map((name, i) => ({
    name,
    weight: weights[i],
    minutes: Math.round((budget * weights[i]) / total),
  }));
}

/** Format minutes as "Xh Ym" (or "Ym" under an hour). */
export function fmtMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function todayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}
