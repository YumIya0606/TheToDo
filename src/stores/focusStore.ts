import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FocusState {
  isActive: boolean;
  isRunning: boolean;
  activeTaskId: string | null;
  selectedSubject: string | null;

  /** Stopwatch: elapsed seconds for the current (un-saved) session */
  currentSessionSeconds: number;

  /**
   * Date → Subject → total seconds studied that day.
   *
   * One canonical date format, produced only by `dayKey()`. Anything written by
   * hand elsewhere used to drift, which is how the same 35 minutes ended up
   * appearing on every day.
   */
  studyAnalytics: Record<string, Record<string, number>>;

  /**
   * Minutes the student is aiming for on a day. A real number the student
   * chooses, not a fraction of whatever free time happens to be left, which made
   * the goal move every day and read permanently full.
   */
  dailyGoalMinutes: number;

  /** Dates the student has pinned a goal on; the rest follow the default. */
  goalOverrides: Record<string, number>;

  toggleFocusMode: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  /** Abandon the current un-saved session (does NOT wipe DB stats) */
  resetTimer: () => void;
  setActiveTask: (taskId: string | null) => void;
  /** Switch subject — commits the current session to previously selected subject first */
  setSubject: (subject: string | null) => void;
  tick: () => void;
  addManualTime: (subject: string, seconds: number, date: string) => void;
  /** Directly set the stored total for a subject on a given date (bug-proof inline edit). */
  editDailyTotal: (subject: string, newSeconds: number, date: string) => void;
  /** The goal in minutes for a given date, honouring a per-day override. */
  goalFor: (date: string) => number;
  setDailyGoal: (minutes: number, date?: string) => void;
  clearDailyGoalOverride: (date: string) => void;
  /**
   * Repair stored analytics.
   *
   * Earlier versions could write a value under a date in a different format,
   * and an entry with no seconds is never useful. Returns how many keys were
   * removed so the caller can say so honestly.
   */
  repairAnalytics: () => { removedEmpty: number; removedInvalid: number; merged: number };
}

/** The one place a date key is made. Everything else goes through this. */
export function dayKey(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Accepts only YYYY-MM-DD, so a stray format cannot be written silently. */
const isDayKey = (k: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(k);

const DEFAULT_GOAL_MINUTES = 120;

function todayKey(): string {
  return dayKey();
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      isActive: false,
      isRunning: false,
      activeTaskId: null,
      selectedSubject: null,
      currentSessionSeconds: 0,
      studyAnalytics: {},
      dailyGoalMinutes: DEFAULT_GOAL_MINUTES,
      goalOverrides: {},

      toggleFocusMode: () =>
        set((state) => ({ isActive: !state.isActive, isRunning: false })),

      startTimer: () => set({ isRunning: true }),

      pauseTimer: () => set({ isRunning: false }),

      resetTimer: () =>
        set({ currentSessionSeconds: 0, isRunning: false }),

      setActiveTask: (taskId) => set({ activeTaskId: taskId }),

      setSubject: (subject) => {
        const state = get();
        const prev = state.selectedSubject;
        const session = state.currentSessionSeconds;
        const date = todayKey();

        // Switching to a different subject while a session exists:
        // commit the session to the previous subject, then start fresh.
        if (prev && session > 0 && prev !== subject) {
          set((s) => ({
            selectedSubject: subject,
            currentSessionSeconds: 0,
            isRunning: false,
            studyAnalytics: {
              ...s.studyAnalytics,
              [date]: {
                ...(s.studyAnalytics[date] || {}),
                [prev]: (s.studyAnalytics[date]?.[prev] || 0) + session,
              },
            },
          }));
        } else {
          set({ selectedSubject: subject });
        }
      },

      tick: () =>
        set((state) => {
          if (!state.isRunning) return state;
          return { currentSessionSeconds: state.currentSessionSeconds + 1 };
        }),

      // A malformed or missing date is ignored rather than guessed at. Writing
      // to an invented key is exactly what made one day's time reappear on
      // every other day.
      addManualTime: (subject, seconds, date) =>
        set((state) => {
          const key = isDayKey(date) ? date : todayKey();
          const day = state.studyAnalytics[key] ?? {};
          return {
            studyAnalytics: {
              ...state.studyAnalytics,
              [key]: { ...day, [subject]: (day[subject] || 0) + Math.max(0, Math.floor(seconds)) },
            },
          };
        }),

      editDailyTotal: (subject, newSeconds, date) =>
        set((state) => {
          const key = isDayKey(date) ? date : todayKey();
          const seconds = Math.max(0, Math.floor(newSeconds));
          if (seconds === 0) {
            const day = { ...(state.studyAnalytics[key] ?? {}) };
            delete day[subject];
            const next = { ...state.studyAnalytics };
            if (Object.keys(day).length === 0) delete next[key];
            else next[key] = day;
            return { studyAnalytics: next };
          }
          const day = state.studyAnalytics[key] ?? {};
          return {
            studyAnalytics: { ...state.studyAnalytics, [key]: { ...day, [subject]: seconds } },
          };
        }),

      goalFor: (date) =>
        get().goalOverrides?.[date] ?? get().dailyGoalMinutes ?? DEFAULT_GOAL_MINUTES,

      setDailyGoal: (minutes, date) =>
        set((state) => {
          const value = Math.max(15, Math.min(14 * 60, Math.round(minutes)));
          if (!date || date === todayKey()) return { dailyGoalMinutes: value };
          const overrides = { ...(state.goalOverrides ?? {}), [date]: value };
          return { goalOverrides: overrides };
        }),

      clearDailyGoalOverride: (date) =>
        set((state) => {
          const overrides = { ...(state.goalOverrides ?? {}) };
          delete overrides[date];
          return { goalOverrides: overrides };
        }),

      repairAnalytics: () => {
        let removedEmpty = 0;
        let removedInvalid = 0;
        let merged = 0;

        set((state) => {
          const rebuilt: Record<string, Record<string, number>> = {};
          for (const [key, rawDay] of Object.entries(state.studyAnalytics ?? {})) {
            const day: Record<string, number> = {};
            for (const [subject, seconds] of Object.entries((rawDay ?? {}) as Record<string, unknown>)) {
              const n =
                typeof seconds === 'number' && Number.isFinite(seconds) ? Math.floor(seconds) : 0;
              if (n <= 0) {
                removedEmpty += 1;
                continue;
              }
              day[subject] = n;
            }
            if (Object.keys(day).length === 0) {
              removedEmpty += 1;
              continue;
            }
            if (!isDayKey(key)) {
              // Keep the data rather than dropping it: fold it into today, which
              // is where it was almost certainly meant to go.
              merged += 1;
              const today = todayKey();
              const target = rebuilt[today] ?? {};
              for (const [subject, seconds] of Object.entries(day)) {
                target[subject] = (target[subject] ?? 0) + seconds;
              }
              rebuilt[today] = target;
              continue;
            }
            // The same date can only exist once, but a hand-edited backup can
            // have duplicated it; add rather than replace so nothing is lost.
            if (rebuilt[key]) {
              merged += 1;
              for (const [subject, seconds] of Object.entries(day)) {
                rebuilt[key][subject] = (rebuilt[key][subject] ?? 0) + seconds;
              }
            } else {
              rebuilt[key] = day;
            }
          }
          return { studyAnalytics: rebuilt };
        });

        return { removedEmpty, removedInvalid, merged };
      },
    }),
    {
      name: 'thetodo-focus-storage',
      // Persist only analytics + goals + subject preference; timer state is
      // ephemeral.
      partialize: (state) => ({
        studyAnalytics: state.studyAnalytics,
        dailyGoalMinutes: state.dailyGoalMinutes,
        goalOverrides: state.goalOverrides,
        selectedSubject: state.selectedSubject,
      }),
      // An older build could write analytics under a date key it did not
      // guarantee, and had no goal at all. Repair once on load so a bad key
      // stops reappearing on every day, keeping every valid total.
      version: 1,
      migrate: (persisted: any) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const rebuilt: Record<string, Record<string, number>> = {};
        const today = dayKey();
        for (const [key, day] of Object.entries(persisted.studyAnalytics ?? {})) {
          const clean: Record<string, number> = {};
          for (const [subject, seconds] of Object.entries((day ?? {}) as Record<string, unknown>)) {
            const n = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.floor(seconds) : 0;
            if (n > 0) clean[subject] = n;
          }
          if (Object.keys(clean).length === 0) continue;
          const target = /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : today;
          const existing = rebuilt[target] ?? {};
          for (const [subject, seconds] of Object.entries(clean)) {
            existing[subject] = (existing[subject] ?? 0) + seconds;
          }
          rebuilt[target] = existing;
        }
        return {
          ...persisted,
          studyAnalytics: rebuilt,
          dailyGoalMinutes:
            typeof persisted.dailyGoalMinutes === 'number' && persisted.dailyGoalMinutes > 0
              ? persisted.dailyGoalMinutes
              : DEFAULT_GOAL_MINUTES,
          goalOverrides: persisted.goalOverrides ?? {},
        };
      },
    }
  )
);

/** Convenience selector: total seconds for a subject on a given date. */
export function getSubjectSecondsForToday(
  analytics: FocusState['studyAnalytics'],
  subject: string,
  date: string
): number {
  return analytics[date]?.[subject] ?? 0;
}

export { todayKey as getTodayKey };
