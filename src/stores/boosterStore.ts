import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoosterKind = 'speed' | 'theory';

export interface BoosterEpisode {
  /** Canonical episode number (equals its position + 1). */
  num: number;
  /** Duration in minutes — boosters come in different lengths. */
  minutes: number;
  watched: boolean;
}

export interface BoosterSeries {
  id: BoosterKind;
  name: string;
  episodes: BoosterEpisode[];
}

/** Durations tuition boosters actually come in (minutes). 60 = 1h. */
export const DURATION_PRESETS = [30, 35, 40, 45, 50, 60] as const;
export const DEFAULT_MINUTES = 45;

/** Seed counts — theory runs long (300+), speed is shorter. Adjustable in-app. */
const SPEED_SEED = 140;
const THEORY_SEED = 320;

function seedEpisodes(count: number): BoosterEpisode[] {
  return Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    minutes: DURATION_PRESETS[i % DURATION_PRESETS.length],
    watched: false,
  }));
}

function renumber(episodes: BoosterEpisode[]): BoosterEpisode[] {
  return episodes.map((e, i) => ({ ...e, num: i + 1 }));
}

/**
 * Every mutation flows through this pure reducer so the overlay window can
 * apply the same change optimistically to its local view without touching the
 * persisted store (only the main window persists).
 */
export type BoosterAction =
  | { type: 'toggle'; series: BoosterKind; num: number }
  | { type: 'setMinutes'; series: BoosterKind; num: number; minutes: number }
  | { type: 'markRange'; series: BoosterKind; from: number; to: number; minutes: number }
  | { type: 'add'; series: BoosterKind; minutes: number }
  | { type: 'setCount'; series: BoosterKind; count: number }
  | { type: 'reset'; series: BoosterKind };

export function reduceBoosterAction(series: BoosterSeries[], a: BoosterAction): BoosterSeries[] {
  const match = (s: BoosterSeries) => s.id === a.series;
  switch (a.type) {
    case 'toggle':
      return series.map((s) =>
        !match(s)
          ? s
          : { ...s, episodes: s.episodes.map((e) => (e.num === a.num ? { ...e, watched: !e.watched } : e)) }
      );
    case 'setMinutes':
      return series.map((s) =>
        !match(s)
          ? s
          : { ...s, episodes: s.episodes.map((e) => (e.num === a.num ? { ...e, minutes: a.minutes } : e)) }
      );
    case 'markRange':
      // Everything in [from, to] is watched, all at the chosen average length.
      return series.map((s) =>
        !match(s)
          ? s
          : {
              ...s,
              episodes: s.episodes.map((e) =>
                e.num >= a.from && e.num <= a.to ? { ...e, watched: true, minutes: a.minutes } : e
              ),
            }
      );
    case 'add':
      return series.map((s) =>
        !match(s)
          ? s
          : { ...s, episodes: [...s.episodes, { num: s.episodes.length + 1, minutes: a.minutes, watched: false }] }
      );
    case 'setCount':
      return series.map((s) => {
        if (!match(s)) return s;
        const current = s.episodes.length;
        if (a.count <= current) {
          return { ...s, episodes: renumber(s.episodes.slice(0, Math.max(0, a.count))) };
        }
        const extra = Array.from({ length: a.count - current }, (_, i) => ({
          num: current + i + 1,
          minutes: DURATION_PRESETS[(current + i) % DURATION_PRESETS.length],
          watched: false,
        }));
        return { ...s, episodes: [...s.episodes, ...extra] };
      });
    case 'reset':
      return series.map((s) => (match(s) ? { ...s, episodes: s.episodes.map((e) => ({ ...e, watched: false })) } : s));
    default:
      return series;
  }
}

/**
 * What the physics theory channel says to work on next.
 *
 * Held beside the series rather than inside them, deliberately. The grid renders
 * 460 memoised tiles keyed on episode props, so anything that touched
 * `series` would re-render every tile; a separate top-level field means a change
 * of study plan costs one small banner and zero chips.
 */
export interface StudyPointer {
  kind: BoosterKind | 'other';
  episode: number | null;
  tute: string | null;
  questionStart: number | null;
  questionEnd: number | null;
  questionCount: number | null;
  postedAt: number;
  headline: string | null;
  original: string;
}

interface BoosterState {
  series: BoosterSeries[];
  /** Latest "which questions, which tute, which episode" from ClassRadar. */
  pointer: StudyPointer | null;
  setPointer: (p: StudyPointer | null) => void;
  toggleWatched: (series: BoosterKind, num: number) => void;
  /** Mark a range [from, to] as watched at a chosen average length. */
  markRangeWatched: (series: BoosterKind, from: number, to: number, minutes: number) => void;
  addEpisode: (series: BoosterKind, minutes: number) => void;
  /** Grow or trim a series to an exact episode count. */
  setSeriesCount: (series: BoosterKind, count: number) => void;
  resetSeries: (series: BoosterKind) => void;
}

export const useBoosterStore = create<BoosterState>()(
  persist(
    (set) => ({
      series: [
        { id: 'speed', name: 'Speed Boosters', episodes: seedEpisodes(SPEED_SEED) },
        { id: 'theory', name: 'Theory Boosters', episodes: seedEpisodes(THEORY_SEED) },
      ],
      pointer: null,

      // A plain field write: it never touches `series`, so no episode tile is
      // asked to re-render when the study plan changes.
      setPointer: (p) => set({ pointer: p }),

      toggleWatched: (s, num) => set((st) => ({ series: reduceBoosterAction(st.series, { type: 'toggle', series: s, num }) })),
      markRangeWatched: (s, from, to, minutes) =>
        set((st) => ({ series: reduceBoosterAction(st.series, { type: 'markRange', series: s, from, to, minutes }) })),
      addEpisode: (s, minutes) => set((st) => ({ series: reduceBoosterAction(st.series, { type: 'add', series: s, minutes }) })),
      setSeriesCount: (s, count) => set((st) => ({ series: reduceBoosterAction(st.series, { type: 'setCount', series: s, count }) })),
      resetSeries: (s) => set((st) => ({ series: reduceBoosterAction(st.series, { type: 'reset', series: s }) })),
    }),
    { name: 'thetodo-boosters-v2', version: 2 }
  )
);

export function selectSeries(state: BoosterState, id: BoosterKind): BoosterSeries | undefined {
  return state.series.find((s) => s.id === id);
}

export interface BoosterStats {
  total: number;
  watched: number;
  left: number;
  /** Unwatched episodes below your highest watched one — the ones you skipped. */
  missed: number;
  /** Highest episode number you've watched (0 = none). */
  highest: number;
  watchedMinutes: number;
  totalMinutes: number;
}

export function boosterStats(series: BoosterSeries | undefined): BoosterStats {
  const empty: BoosterStats = { total: 0, watched: 0, left: 0, missed: 0, highest: 0, watchedMinutes: 0, totalMinutes: 0 };
  if (!series) return empty;
  let watched = 0;
  let highest = 0;
  let watchedMinutes = 0;
  let totalMinutes = 0;
  for (const e of series.episodes) {
    totalMinutes += e.minutes;
    if (e.watched) {
      watched++;
      highest = Math.max(highest, e.num);
      watchedMinutes += e.minutes;
    }
  }
  let missed = 0;
  if (highest > 0) {
    for (const e of series.episodes) if (!e.watched && e.num < highest) missed++;
  }
  return { total: series.episodes.length, watched, left: series.episodes.length - watched, missed, highest, watchedMinutes, totalMinutes };
}

/** "1h 20m" style formatting for durations. */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
