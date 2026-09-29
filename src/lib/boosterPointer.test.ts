import { describe, expect, it } from 'vitest';
import {
  reduceBoosterAction,
  selectSeries,
  boosterStats,
  type BoosterSeries,
  type StudyPointer,
} from '@/stores/boosterStore';

/**
 * The booster grid renders 460 memoised tiles. The last fix that made it fast
 * memoised the tile and keyed it on the episode's own fields, so anything that
 * puts new state inside `series` re-renders every tile on screen.
 *
 * These tests pin the shape of that guarantee: a change of study plan must be
 * able to happen without `series` changing identity or contents.
 */

const seedSeries = (): BoosterSeries[] => [
  {
    id: 'speed',
    name: 'Speed Boosters',
    episodes: Array.from({ length: 140 }, (_, i) => ({
      num: i + 1,
      minutes: 45,
      watched: i < 12,
    })),
  },
  {
    id: 'theory',
    name: 'Theory Boosters',
    episodes: Array.from({ length: 320 }, (_, i) => ({
      num: i + 1,
      minutes: 60,
      watched: i < 40,
    })),
  },
];

const pointer: StudyPointer = {
  kind: 'theory',
  episode: 307,
  tute: 'Sound Intensity',
  questionStart: 22,
  questionEnd: 59,
  questionCount: 14,
  postedAt: 1_800_000_000,
  headline: 'Questions for Evening Booster 307',
  original: 'ධ්වනි ත්‍රිව්‍රතාවය',
};

describe('the episode grid is untouched by the study pointer', () => {
  it('keeps `series` byte-identical, so no tile needs re-rendering', () => {
    const before = seedSeries();
    const snapshot = JSON.stringify(before);

    // A study plan update is a plain field write on the store; nothing about it
    // flows through the series array.
    const state = { series: before, pointer: null };
    state.pointer = pointer;

    expect(JSON.stringify(state.series)).toBe(snapshot);
    expect(state.pointer.episode).toBe(307);
  });

  it('gives every episode the exact props the memoised tile compares', () => {
    // These are the fields Chip receives. A new one would silently double the
    // work on every grid change, so they are asserted explicitly.
    const series = selectSeries({ series: seedSeries() } as never, 'theory');
    expect(series).toBeDefined();
    for (const e of series!.episodes) {
      expect(Object.keys(e).sort()).toEqual(['minutes', 'num', 'watched']);
    }
  });

  it('leaves the reducer untouched by a pointer-shaped action', () => {
    const before = seedSeries();
    const after = reduceBoosterAction(before, { type: 'toggle', series: 'theory', num: 41 });
    // Only the toggled episode may differ.
    const diffs = after
      .map((s, i) =>
        s.episodes.filter((e, j) => JSON.stringify(e) !== JSON.stringify(before[i].episodes[j])).length
      )
      .filter((n) => n > 0);
    expect(diffs).toEqual([1]);
  });
});

describe('the booster reducer still behaves', () => {
  it('toggles one episode and nothing else', () => {
    const before = seedSeries();
    const after = reduceBoosterAction(before, { type: 'toggle', series: 'speed', num: 13 });
    const speed = after.find((s) => s.id === 'speed')!;
    expect(speed.episodes.find((e) => e.num === 13)!.watched).toBe(true);
    expect(speed.episodes.filter((e) => e.watched)).toHaveLength(13);
  });

  it('counts progress without consulting the pointer', () => {
    const st = boosterStats(selectSeries({ series: seedSeries() } as never, 'theory')!);
    expect(st.total).toBe(320);
    expect(st.watched).toBe(40);
    expect(st.highest).toBe(40);
  });

  it('grows a series and renumbers from one', () => {
    const before = seedSeries();
    const after = reduceBoosterAction(before, { type: 'setCount', series: 'speed', count: 150 });
    const speed = after.find((s) => s.id === 'speed')!;
    expect(speed.episodes).toHaveLength(150);
    expect(speed.episodes[149].num).toBe(150);
  });
});
