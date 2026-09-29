import { describe, expect, it } from 'vitest';
import { draftsFromEvents, toTaskDraft, existingFingerprints } from '@/lib/classRadarTasks';
import type { RadarEvent } from '@/lib/classRadar';
import type { Task } from '@/types';

const ev = (over: Partial<RadarEvent> = {}): RadarEvent => ({
  id: 1,
  subject: 'physics',
  classType: 'paper',
  title: '2027 Physics Paper 02',
  date: '2026-10-02',
  startTime: '07:00',
  endTime: '12:00',
  status: 'scheduled',
  isFullSyllabus: true,
  note: '',
  action: null,
  urgency: 'normal',
  confidence: 0.8,
  links: [],
  sources: [],
  ...over,
});

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    title: '2027 Physics Paper 02',
    status: 'todo',
    priority: 'medium',
    category: 'AL Physics',
    tags: ['class'],
    completedSubtasks: 0,
    totalSubtasks: 0,
    createdAt: '',
    updatedAt: '',
    dueDate: '2026-10-02',
    ...over,
  }) as Task;

describe('turning a reading into a task', () => {
  it('makes a task from a paper, dated and tagged', () => {
    const d = toTaskDraft(ev());
    expect(d).not.toBeNull();
    expect(d!.dueDate).toBe('2026-10-02');
    expect(d!.subject).toBe('AL Physics');
    expect(d!.tags).toContain('class');
    expect(d!.tags).toContain('full-syllabus');
  });

  it('includes the action in the title when there is one', () => {
    const d = toTaskDraft(ev({ action: 'Submit answers by 12:30 PM' }));
    expect(d!.title).toContain('Submit answers by 12:30 PM');
  });

  it('skips an announcement with nothing to do', () => {
    expect(toTaskDraft(ev({ title: 'Class today at 7:00', isFullSyllabus: false, action: null }))).toBeNull();
  });

  it('skips a cancelled class and one with no date', () => {
    expect(toTaskDraft(ev({ status: 'cancelled' }))).toBeNull();
    expect(toTaskDraft(ev({ date: null }))).toBeNull();
  });

  it('picks up a recording to watch', () => {
    const d = toTaskDraft(
      ev({ title: 'YouTube premiere', classType: 'theory', isFullSyllabus: false, action: 'Watch the recording' })
    );
    expect(d).not.toBeNull();
  });
});

describe('no duplicates', () => {
  it('does not offer the same reading twice', () => {
    const events = [ev({ id: 1 }), ev({ id: 1 }), ev({ id: 2, title: 'Something else' })];
    const drafts = draftsFromEvents(events, []);
    expect(drafts).toHaveLength(2);
  });

  it('skips a reading already imported as a task', () => {
    const events = [ev({ id: 1 })];
    const existing = [task()];
    expect(draftsFromEvents(events, existing)).toHaveLength(0);
  });

  it('fingerprints only class tasks, so a same-named ordinary task is unaffected', () => {
    const plain = [task({ tags: ['home'] })];
    expect(existingFingerprints(plain).size).toBe(0);
    expect(draftsFromEvents([ev()], plain)).toHaveLength(1);
  });

  it('treats a different date as a different task', () => {
    const existing = [task()];
    const later = draftsFromEvents([ev({ date: '2026-10-09' })], existing);
    expect(later).toHaveLength(1);
  });
});
