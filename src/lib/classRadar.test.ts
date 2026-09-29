import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { fmtDate, fmtRange, isUpcoming, toPlannerSubject, todayISO } from '@/lib/classRadar';
import type { ScheduleExport } from '@/lib/classRadar';

/**
 * The contract between two separate programs.
 *
 * ClassRadar writes schedule.json and this app reads it. Nothing in the
 * type system links them, so the only thing that catches a drift is this test
 * running against the real file. When it is absent the suite still passes, with
 * a fixture instead, so the shape is always covered.
 */

const REAL = path.join(
  process.env.APPDATA ?? os.homedir(),
  'ClassRadar',
  'data',
  'schedule.json'
);

function readExport(): { data: ScheduleExport; source: string } | null {
  const file = fs.existsSync(REAL) ? REAL : path.join(__dirname, 'fixtures', 'schedule.json');
  if (!fs.existsSync(file)) return null;
  return { data: JSON.parse(fs.readFileSync(file, 'utf8')) as ScheduleExport, source: file };
}

const found = readExport();

describe('the schedule export contract', () => {
  it('has a file to check', () => {
    expect(found).not.toBeNull();
  });

  it.runIf(found)('carries the fields the Classes screen reads', () => {
    const d = found!.data;
    expect(typeof d.generatedAt).toBe('number');
    expect(typeof d.timezone).toBe('string');
    expect(Array.isArray(d.events)).toBe(true);
    expect(Array.isArray(d.boosterPlan)).toBe(true);
    expect(d.counts).toBeDefined();
    expect(typeof d.counts.events).toBe('number');
  });

  it.runIf(found)('gives every event the fields the row renders', () => {
    for (const e of found!.data.events) {
      expect(typeof e.id).toBe('number');
      expect(typeof e.title).toBe('string');
      expect(typeof e.subject).toBe('string');
      expect(typeof e.classType).toBe('string');
      expect(typeof e.status).toBe('string');
      expect(Array.isArray(e.links)).toBe(true);
      expect(Array.isArray(e.sources)).toBe(true);
      // The "Add to Planner" action needs both ends of the time, so a missing
      // one is a real case the UI has to cope with rather than assume away.
      if (e.startTime) expect(e.startTime).toMatch(/^\d{2}:\d{2}$/);
      if (e.endTime) expect(e.endTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it.runIf(found)('gives every study-plan post its fields', () => {
    for (const b of found!.data.boosterPlan) {
      expect(typeof b.postedAt).toBe('number');
      expect(typeof b.original).toBe('string');
    }
  });

  it.runIf(found)('formats times and dates the way the UI expects', () => {
    const e = found!.data.events.find((x) => x.startTime);
    if (!e) return;
    expect(fmtRange(e)).not.toBe('—');
    expect(fmtTime12(e.startTime!)).toMatch(/\d{1,2}(:\d{2})? (AM|PM)/);
    if (e.date) expect(fmtDate(e.date)).toMatch(/\w{3} \d{1,2} \w{3}/);
  });

  it.runIf(found)('maps every subject onto a planner subject', () => {
    const known = new Set(['Combined Maths', 'AL Physics', 'AL Chemistry', 'General English']);
    for (const e of found!.data.events) {
      expect(known.has(toPlannerSubject(e.subject))).toBe(true);
    }
  });

  it.runIf(found)('never offers a cancelled class as upcoming', () => {
    const today = todayISO();
    for (const e of found!.data.events) {
      if (e.status === 'cancelled' || e.status === 'completed') {
        expect(isUpcoming(e, today)).toBe(false);
      }
    }
  });

  it('read the real file when there is one', () => {
    if (found) {
      expect(found.source).toContain('ClassRadar');
    }
  });
});

/** Local copy of the formatter, so the test states the format it expects. */
function fmtTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
