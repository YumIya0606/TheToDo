import type { Cadence, Commitment } from '@/types';

/**
 * The student's actual weekly tuition timetable.
 *
 * Seeded once, then entirely the student's to edit: these are ordinary
 * commitments, not a locked schedule. Two entries are deliberately marked as
 * needing attention, because guessing a day for them would quietly eat free
 * study time in the wrong week — see NEEDS_REVIEW below.
 */

/** Monday = 1 … Sunday = 0, matching the Commitment day indexes. */
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;
const SUN = 0;

export interface SeedCommitment {
  label: string;
  subject?: string;
  startTime: string;
  endTime: string;
  days: number[];
  cadence?: Cadence;
  /** Set when the day is not fixed and the student must choose. */
  needsReview?: string;
  offThisWeek?: boolean;
}

export const SEED_TIMETABLE: SeedCommitment[] = [
  {
    label: 'Applied Maths Class',
    subject: 'Combined Maths',
    startTime: '14:30',
    endTime: '17:30',
    days: [MON],
  },
  {
    label: 'Physics Speed Class',
    subject: 'AL Physics',
    startTime: '20:00',
    // Runs to midnight. The store already handles an end before the start by
    // wrapping past midnight, so 00:00 here reads as a four-hour block.
    endTime: '00:00',
    days: [MON],
  },
  {
    label: 'Combined Maths Paper Class',
    subject: 'Combined Maths',
    startTime: '15:30',
    endTime: '18:30',
    days: [TUE],
  },
  {
    label: 'Physics Paper Class',
    subject: 'AL Physics',
    startTime: '07:00',
    endTime: '12:00',
    days: [WED],
    cadence: 'fortnightly',
    offThisWeek: true,
  },
  {
    label: 'Physics Theory Class',
    subject: 'AL Physics',
    startTime: '15:00',
    endTime: '19:00',
    days: [THU],
  },
  {
    label: 'Applied Paper Class',
    subject: 'Combined Maths',
    startTime: '20:30',
    endTime: '22:30',
    days: [THU],
  },
  {
    label: 'Chemistry Paper Class',
    subject: 'AL Chemistry',
    startTime: '12:00',
    endTime: '17:00',
    days: [WED],
    cadence: 'fortnightly',
    // The student said "Thursday or Wednesday". Wednesday is where their other
    // chemistry block already sits, so that is the safer default, but it is
    // flagged rather than treated as known.
    needsReview: 'Day not confirmed — you said Thursday or Wednesday. Set to Wednesday; change it if needed.',
  },
  {
    label: 'Chemistry Paper Discussion',
    subject: 'AL Chemistry',
    startTime: '14:30',
    endTime: '16:30',
    days: [WED],
    cadence: 'fortnightly',
  },
  {
    label: 'Combined Maths Theory Class',
    subject: 'Combined Maths',
    startTime: '07:30',
    endTime: '12:00',
    days: [SAT],
  },
  {
    label: 'Chemistry Theory Class',
    subject: 'AL Chemistry',
    startTime: '13:00',
    endTime: '17:00',
    days: [SUN],
  },
  {
    label: 'Gaming',
    startTime: '20:00',
    endTime: '22:00',
    days: [FRI],
    needsReview: 'Start time is a guess — you said two hours on Friday. Change it if that is wrong.',
  },
];

/** Entries the student should confirm rather than trust silently. */
export const NEEDS_REVIEW = SEED_TIMETABLE.filter((c) => c.needsReview);

export function seedCommitments(genId: () => string): Commitment[] {
  return SEED_TIMETABLE.map((c) => ({
    id: genId(),
    label: c.label,
    startTime: c.startTime,
    endTime: c.endTime,
    days: c.days,
    cadence: c.cadence,
    offThisWeek: c.offThisWeek,
    subject: c.subject,
    source: 'manual' as const,
  }));
}
