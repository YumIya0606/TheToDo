import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FocusState {
  isActive: boolean;
  isRunning: boolean;
  activeTaskId: string | null;
  selectedSubject: string | null;

  /** Stopwatch: elapsed seconds for the current (un-saved) session */
  currentSessionSeconds: number;

  /** Date → Subject → total seconds studied that day */
  studyAnalytics: Record<string, Record<string, number>>;

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
}

function todayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
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

      addManualTime: (subject, seconds, date) =>
        set((state) => {
          const day = state.studyAnalytics[date] || {};
          return {
            studyAnalytics: {
              ...state.studyAnalytics,
              [date]: {
                ...day,
                [subject]: (day[subject] || 0) + Math.max(0, Math.floor(seconds)),
              },
            },
          };
        }),

      editDailyTotal: (subject, newSeconds, date) =>
        set((state) => {
          const day = state.studyAnalytics[date] || {};
          return {
            studyAnalytics: {
              ...state.studyAnalytics,
              [date]: {
                ...day,
                [subject]: Math.max(0, Math.floor(newSeconds)),
              },
            },
          };
        }),
    }),
    {
      name: 'thetodo-focus-storage',
      // Persist only analytics + subject preference; timer state is ephemeral
      partialize: (state) => ({
        studyAnalytics: state.studyAnalytics,
        selectedSubject: state.selectedSubject,
      }),
    }
  )
);

/** Convenience selector: total seconds for a subject today (DB only, not current session) */
export function getSubjectSecondsForToday(analytics: FocusState['studyAnalytics'], subject: string, date: string): number {
  return analytics[date]?.[subject] ?? 0;
}

export { todayKey as getTodayKey };
