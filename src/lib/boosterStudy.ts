import {
  reduceBoosterAction,
  selectSeries,
  useBoosterStore,
  type BoosterAction,
  type BoosterSeries,
} from '@/stores/boosterStore';
import { getTodayKey, useFocusStore } from '@/stores/focusStore';

/** Boosters are physics-tuition videos — their watch time counts here. */
export const PHYSICS_SUBJECT = 'AL Physics';

function watchedMinutes(series: BoosterSeries | undefined): number {
  if (!series) return 0;
  let sum = 0;
  for (const e of series.episodes) if (e.watched) sum += e.minutes;
  return sum;
}

/**
 * Apply a booster change. Safe to run in any window — touches only the booster
 * store's in-memory state. The overlay uses this on a local view copy.
 */
export function applyBoosterChange(a: BoosterAction) {
  useBoosterStore.setState((st) => ({ series: reduceBoosterAction(st.series, a) }));
}

/**
 * Apply a booster change and log the resulting watch-time delta into physics
 * study analytics — the same numbers Focus Mode and the Planner read.
 *
 * Main window only: the analytics store is owned by the main window, so running
 * this from the overlay would clobber it with a partial copy. The overlay emits
 * `booster-action` instead and the main window calls this.
 */
export function applyBoosterChangeWithStudy(a: BoosterAction) {
  const before = selectSeries(useBoosterStore.getState(), a.series);
  applyBoosterChange(a);
  const after = selectSeries(useBoosterStore.getState(), a.series);
  const delta = watchedMinutes(after) - watchedMinutes(before);
  if (delta !== 0) {
    useFocusStore.getState().addManualTime(PHYSICS_SUBJECT, delta * 60, getTodayKey());
  }
}
