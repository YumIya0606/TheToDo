import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Commitment, StudyReminder } from '@/types';

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
    }),
    { name: 'thetodo-planner-storage' }
  )
);

/* ── Derived helpers (pure) ─────────────────────────────────────────────── */

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

export function dayCommitments(commitments: Commitment[], dayOfWeek: number): Commitment[] {
  return commitments.filter((c) => c.days.includes(dayOfWeek));
}

/** Free minutes in a day = 1440 − everything occupied that day. */
export function freeMinutesForDay(commitments: Commitment[], dayOfWeek: number): number {
  const used = dayCommitments(commitments, dayOfWeek).reduce((sum, c) => sum + commitmentDuration(c), 0);
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
