import { describe, expect, it } from 'vitest';
import {
  commitmentDuration,
  dayCommitments,
  freeMinutesForDay,
  isCommitmentActiveOn,
} from '@/stores/plannerStore';
import { SEED_TIMETABLE, seedCommitments } from '@/lib/seedTimetable';
import type { Commitment } from '@/types';

let n = 0;
const genId = () => `c_test_${++n}`;

describe('fortnightly commitments', () => {
  const weekly: Commitment = {
    id: 'w',
    label: 'Weekly class',
    startTime: '09:00',
    endTime: '10:00',
    days: [1],
  };

  const fortnightly: Commitment = {
    id: 'f',
    label: 'Alt-week class',
    startTime: '09:00',
    endTime: '10:00',
    days: [1],
    cadence: 'fortnightly',
    anchorDate: '2026-09-21', // a Monday
  };

  const anchor = new Date('2026-09-21T00:00:00'); // a Monday
  const oneWeekOn = new Date('2026-09-28T00:00:00');
  const twoWeeksOn = new Date('2026-10-05T00:00:00');
  // 2027-01-04 is exactly 15 Mondays after the anchor, so it is an off week.
  const oddWeeksLater = new Date('2027-01-04T00:00:00');
  // 2027-01-11 is 16 weeks on: an on-week, well past a year boundary.
  const evenWeeksLater = new Date('2027-01-11T00:00:00');

  it('treats a plain commitment as weekly', () => {
    expect(isCommitmentActiveOn(weekly, anchor)).toBe(true);
    expect(isCommitmentActiveOn(weekly, new Date('2026-11-02T00:00:00'))).toBe(true);
  });

  it('treats a missing cadence as weekly, so old saved data is unchanged', () => {
    const legacy: Commitment = { ...weekly };
    delete legacy.cadence;
    expect(isCommitmentActiveOn(legacy, anchor)).toBe(true);
  });

  it('activates a fortnightly class on its anchor week', () => {
    expect(isCommitmentActiveOn(fortnightly, anchor)).toBe(true);
  });

  it('deactivates it exactly one week later', () => {
    expect(isCommitmentActiveOn(fortnightly, oneWeekOn)).toBe(false);
  });

  it('activates it again two weeks on, across a month boundary', () => {
    expect(isCommitmentActiveOn(fortnightly, twoWeeksOn)).toBe(true);
  });

  it('keeps the two-week rhythm across a year boundary', () => {
    // 15 weeks on is an off week; 16 is an on week, so the pattern cannot have
    // drifted by the time the year turns over.
    expect(isCommitmentActiveOn(fortnightly, oddWeeksLater)).toBe(false);
    expect(isCommitmentActiveOn(fortnightly, evenWeeksLater)).toBe(true);
  });

  it('activates a fortnightly class with no anchor, rather than hiding it', () => {
    const noAnchor: Commitment = { ...fortnightly };
    delete noAnchor.anchorDate;
    expect(isCommitmentActiveOn(noAnchor, anchor)).toBe(true);
  });

  it('honours the explicit off-this-week override', () => {
    const skipped: Commitment = { ...weekly, offThisWeek: true };
    const today = new Date();
    expect(isCommitmentActiveOn(skipped, today)).toBe(false);
  });

  it('frees the time on an off week', () => {
    const freeOn = freeMinutesForDay([fortnightly], 1, anchor);
    const freeOff = freeMinutesForDay([fortnightly], 1, oneWeekOn);
    expect(freeOn).toBe(24 * 60 - 60);
    expect(freeOff).toBe(24 * 60);
  });

  it('filters a day list by the week it falls in', () => {
    expect(dayCommitments([fortnightly], 1, anchor).map((c) => c.id)).toEqual(['f']);
    expect(dayCommitments([fortnightly], 1, oneWeekOn)).toEqual([]);
  });
});

describe('overnight commitments', () => {
  it('wraps a block that ends at midnight', () => {
    const speed: Commitment = {
      id: 's',
      label: 'Physics Speed Class',
      startTime: '20:00',
      endTime: '00:00',
      days: [1],
    };
    expect(commitmentDuration(speed)).toBe(240);
    expect(freeMinutesForDay([speed], 1)).toBe(24 * 60 - 240);
  });
});

describe('the seeded timetable', () => {
  const seeded = seedCommitments(genId);

  it('covers every day the student named a class on', () => {
    const days = new Set(seeded.flatMap((c) => c.days));
    expect([...days].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('marks the three alternate-week classes as fortnightly', () => {
    const fortnightlyLabels = seeded.filter((c) => c.cadence === 'fortnightly').map((c) => c.label);
    expect(fortnightlyLabels).toEqual([
      'Physics Paper Class',
      'Chemistry Paper Class',
      'Chemistry Paper Discussion',
    ]);
  });

  it('marks the physics paper class as the off week this week', () => {
    const paper = seeded.find((c) => c.label === 'Physics Paper Class');
    expect(paper?.offThisWeek).toBe(true);
  });

  it('never overlaps two classes on the same day', () => {
    const overlaps: string[] = [];
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const blocks = seeded
        .filter((c) => c.days.includes(day))
        .map((c) => ({
          label: c.label,
          start: Number(c.startTime.slice(0, 2)) * 60 + Number(c.startTime.slice(3)),
          end: Number(c.endTime.slice(0, 2)) * 60 + Number(c.endTime.slice(3)),
        }))
        .filter((b) => b.start !== b.end)
        .sort((a, b) => a.start - b.start);
      for (let i = 1; i < blocks.length; i++) {
        if (blocks[i].start < blocks[i - 1].end) {
          overlaps.push(`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}: ${blocks[i - 1].label} / ${blocks[i].label}`);
        }
      }
    }
    // Wednesday is the day the student has not fully pinned down, so a clash
    // there is expected and is the reason it is flagged for review.
    const unexpected = overlaps.filter((o) => !o.startsWith('Wed'));
    expect(unexpected).toEqual([]);
  });

  it('flags only the entries whose day or time was not confirmed', () => {
    const flagged = SEED_TIMETABLE.filter((c) => c.needsReview).map((c) => c.label);
    expect(flagged).toEqual(['Chemistry Paper Class', 'Gaming']);
  });
});
