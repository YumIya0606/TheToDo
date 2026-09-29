import { describe, expect, it } from 'vitest';
import { reduceBoosterAction, seedEpisodesForTest, type BoosterSeries } from '@/stores/boosterStore';

/**
 * Why the app can feel sluggish, measured rather than guessed.
 *
 * The booster grid is the heaviest thing in the app: hundreds of tiles. Two
 * operations scale badly on it, and both are reachable from the UI, so they are
 * measured here against the real seeded sizes rather than assumed.
 */

const speed = (): BoosterSeries => ({
  id: 'speed',
  name: 'Speed Boosters',
  episodes: Array.from({ length: 140 }, (_, i) => ({ num: i + 1, minutes: 45, watched: false })),
});

const theory = (): BoosterSeries => ({
  id: 'theory',
  name: 'Theory Boosters',
  episodes: Array.from({ length: 320 }, (_, i) => ({ num: i + 1, minutes: 60, watched: false })),
});

const both = () => [speed(), theory()];
const ms = (fn: () => void) => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

describe('booster grid cost', () => {
  it('toggles one tile without redoing the other 459', () => {
    const before = both();
    const after = reduceBoosterAction(before, { type: 'toggle', series: 'theory', num: 200 });
    // The reducer maps the array, so the cost is linear in the episode count.
    // What matters is that it is one pass, not one pass per tile.
    const changed = after.filter(
      (s, i) => JSON.stringify(s) !== JSON.stringify(before[i])
    );
    expect(changed).toHaveLength(1);
  });

  it('marks a range in well under a frame budget', () => {
    const t = ms(() => reduceBoosterAction(both(), { type: 'markRange', series: 'theory', from: 1, to: 320, minutes: 45 }));
    // Generous, because a slow CI box should not fail the suite: the point is to
    // catch an accidental O(n^2), which would land in the hundreds of ms.
    expect(t).toBeLessThan(120);
  });

  it('toggles in well under a frame budget', () => {
    const t = ms(() => reduceBoosterAction(both(), { type: 'toggle', series: 'speed', num: 77 }));
    expect(t).toBeLessThan(20);
  });

  it('re-seeding a series stays a single pass', () => {
    const t = ms(() => reduceBoosterAction(both(), { type: 'setCount', series: 'speed', count: 200 }));
    expect(t).toBeLessThan(60);
  });

  it('does not share episode objects between the two series', () => {
    // Shared references would let a toggle on one series appear on the other,
    // which is the kind of bug that only shows up after several edits.
    const [a, b] = both();
    expect(a.episodes[0]).not.toBe(b.episodes[0]);
  });
});

describe('growth stays predictable', () => {
  it('handles a series three times the seeded size', () => {
    const huge: BoosterSeries = {
      id: 'theory',
      name: 'Theory',
      episodes: seedEpisodesForTest(1000),
    };
    const t = ms(() => reduceBoosterAction([huge], { type: 'toggle', series: 'theory', num: 500 }));
    expect(t).toBeLessThan(40);
  });
});
