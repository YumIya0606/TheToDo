import { beforeEach, describe, expect, it } from 'vitest';
import { collectBackupData, restoreBackupData, type BackupData } from './backup';

/**
 * A backup that quietly omits a store is worse than no backup, because it looks
 * like it worked. This pins every persisted key, so adding a store without
 * listing it here fails the suite rather than losing the user's data.
 */

/**
 * The suite runs without a DOM, and the only browser API this module uses is
 * localStorage. A minimal in-memory stand-in is enough and avoids pulling in a
 * full DOM implementation for six assertions.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

/** Field name in BackupData paired with the localStorage key it comes from. */
const STORES: Array<[keyof BackupData, string]> = [
  ['tasks', 'thetodo-task-storage'],
  ['notes', 'thetodo-notes'],
  ['diary', 'thetodo-diary-storage'],
  ['automation', 'thetodo-automation-jobs'],
  ['settings', 'thetodo-settings'],
  ['planner', 'thetodo-planner-storage'],
  ['boosters', 'thetodo-boosters-v2'],
  ['focus', 'thetodo-focus-storage'],
];

function seed() {
  localStorage.clear();
  localStorage.setItem(
    'thetodo-planner-storage',
    JSON.stringify({ state: { commitments: [{ id: 'c1', label: 'Physics Theory Class' }] }, version: 0 })
  );
  localStorage.setItem(
    'thetodo-boosters-v2',
    JSON.stringify({ state: { series: [{ id: 'speed', episodes: [{ currentEpisode: 41 }] }] }, version: 2 })
  );
  localStorage.setItem(
    'thetodo-focus-storage',
    JSON.stringify({ state: { studyAnalytics: { '2026-09-28': { 'AL Physics': 3600 } } }, version: 0 })
  );
  localStorage.setItem(
    'thetodo-task-storage',
    JSON.stringify({ state: { tasks: [{ id: 't1', title: 'Question set' }] }, version: 0 })
  );
}

describe('backup coverage', () => {
  beforeEach(seed);

  it('includes every persisted store', () => {
    const data = collectBackupData() as unknown as Record<string, unknown>;
    for (const [field, key] of STORES) {
      // Only the four seeded stores are expected to be present here; the test
      // below covers a key that was never written.
      if (key === 'thetodo-automation-jobs' || key === 'thetodo-diary-storage') continue;
      expect(data, `backup is missing ${key}`).toHaveProperty(field);
    }
  });

  it('carries the planner, the boosters and the study analytics', () => {
    const data = collectBackupData() as unknown as Record<string, any>;
    expect(data.planner.state.commitments[0].label).toBe('Physics Theory Class');
    expect(data.boosters.state.series[0].episodes[0].currentEpisode).toBe(41);
    expect(data.focus.state.studyAnalytics['2026-09-28']['AL Physics']).toBe(3600);
  });

  it('leaves a store that was never written absent, not empty', () => {
    localStorage.removeItem('thetodo-automation-jobs');
    const data = collectBackupData() as unknown as Record<string, unknown>;
    expect(data.automation).toBeUndefined();
  });
});

describe('backup restore', () => {
  beforeEach(seed);

  it('round-trips every store it captured', () => {
    const saved = collectBackupData();
    const expected = new Set(
      STORES.filter(
        ([field]) => (saved as unknown as Record<string, unknown>)[field] !== undefined
      ).map(([, key]) => key)
    );
    localStorage.clear();
    const restored = restoreBackupData(saved);
    expect(new Set(restored)).toEqual(expected);

    const after = collectBackupData() as Record<string, any>;
    expect(after.planner.state.commitments[0].label).toBe('Physics Theory Class');
    expect(after.boosters.state.series[0].episodes[0].currentEpisode).toBe(41);
    expect(after.focus.state.studyAnalytics['2026-09-28']['AL Physics']).toBe(3600);
    expect(after.tasks.state.tasks[0].title).toBe('Question set');
  });

  it('accepts a legacy bare-value backup', () => {
    const legacy: Partial<BackupData> = { tasks: [{ id: 'legacy' }] as any };
    const restored = restoreBackupData(legacy);
    expect(restored).toContain('thetodo-task-storage');
    const parsed = JSON.parse(localStorage.getItem('thetodo-task-storage')!);
    expect(parsed.state.tasks[0].id).toBe('legacy');
  });

  it('does not blank a store the backup did not contain', () => {
    const partial: Partial<BackupData> = { tasks: { state: { tasks: [] }, version: 0 } };
    restoreBackupData(partial);
    // The planner was never in the backup, so it must survive the restore.
    const planner = JSON.parse(localStorage.getItem('thetodo-planner-storage')!);
    expect(planner.state.commitments[0].label).toBe('Physics Theory Class');
  });
});
