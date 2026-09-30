export interface BackupData {
  version: string;
  exportedAt: string;
  tasks: unknown;
  notes: unknown;
  diary: unknown;
  automation: unknown;
  settings: unknown;
  /** The study planner: commitments, reminders, subjects. */
  planner: unknown;
  /** Every booster episode and the watch progress on it. */
  boosters: unknown;
  /** Study-time analytics from Focus Mode. */
  focus: unknown;
  /**
   * A pointer to the reading engine's data folder, so a restore knows where to
   * look. The messages themselves are not copied into a JSON backup: they are
   * re-readable from Telegram at any time, and embedding a database in a
   * download would make the file enormous and useless on its own.
   */
  engine: unknown;
}

export type SaveMethod = 'tauri' | 'browser' | 'cancelled';

const safeParse = (raw: string | null, fallback: unknown) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/** Read a section out of a backup without asserting its exact shape. */
function section(data: Partial<BackupData>, field: string): unknown {
  return (data as unknown as Record<string, unknown>)[field];
}

/**
 * Every persisted key, so a new store cannot be added without appearing in a
 * backup. These five were previously missing, which meant exporting and
 * re-importing silently lost the whole planner, all 460 booster episodes and
 * every hour of study analytics.
 */
const STORAGE_KEYS = {
  tasks: 'thetodo-task-storage',
  notes: 'thetodo-notes',
  diary: 'thetodo-diary-storage',
  automation: 'thetodo-automation-jobs',
  settings: 'thetodo-settings',
  planner: 'thetodo-planner-storage',
  boosters: 'thetodo-boosters-v2',
  focus: 'thetodo-focus-storage',
} as const;

/**
 * Aggregate all persisted Zustand/localStorage data into one backup object.
 */
export async function collectBackupData(): Promise<BackupData> {
  const out = {
    version: '1.2',
    exportedAt: new Date().toISOString(),
  } as BackupData;
  for (const [field, key] of Object.entries(STORAGE_KEYS)) {
    // A key that has never been written stays absent rather than becoming null,
    // so a restore does not overwrite it with an empty store.
    (out as unknown as Record<string, unknown>)[field] = safeParse(
      localStorage.getItem(key),
      undefined
    );
  }

  // Note where the reading engine keeps its messages, so a restore on another
  // machine can be pointed at the right place.
  try {
    const { engineDataDir } = await import('./engine');
    out.engine = { dataDir: await engineDataDir() };
  } catch {
    out.engine = { dataDir: null };
  }

  return out;
}

/**
 * Restore a backup: writes each section back into the exact localStorage keys
 * the persisted Zustand stores rehydrate from, then the app reloads.
 *
 * Accepts both the current export format (full persist envelopes like
 * `{ state: { tasks: [...] }, version: 0 }`) and legacy bare arrays/objects.
 *
 * Returns the list of storage keys actually restored.
 */
export function restoreBackupData(data: Partial<BackupData>): string[] {
  // stateField is the name inside the store's `state`. Empty means the whole
  // state object is the payload.
  const keys: { field: keyof BackupData; storageKey: string; stateField: string }[] = [
    { field: 'tasks', storageKey: STORAGE_KEYS.tasks, stateField: 'tasks' },
    { field: 'notes', storageKey: STORAGE_KEYS.notes, stateField: 'notes' },
    { field: 'diary', storageKey: STORAGE_KEYS.diary, stateField: 'entries' },
    { field: 'automation', storageKey: STORAGE_KEYS.automation, stateField: 'jobs' },
    { field: 'settings', storageKey: STORAGE_KEYS.settings, stateField: '' },
    { field: 'planner', storageKey: STORAGE_KEYS.planner, stateField: '' },
    { field: 'boosters', storageKey: STORAGE_KEYS.boosters, stateField: '' },
    { field: 'focus', storageKey: STORAGE_KEYS.focus, stateField: '' },
  ];

  const restored: string[] = [];
  for (const { field, storageKey, stateField } of keys) {
    const value = section(data, field);
    if (value === undefined || value === null) continue;

    // Already a persist envelope ({ state, version }) — write it back verbatim.
    const isEnvelope =
      typeof value === 'object' && !Array.isArray(value) && 'state' in (value as Record<string, unknown>);

    const payload = isEnvelope
      ? value
      : { state: stateField ? { [stateField]: value } : value, version: 0 };

    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      restored.push(storageKey);
    } catch {
      /* storage full/blocked — skip this section */
    }
  }

  return restored;
}

function browserDownload(jsonString: string) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thetodo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save backup to disk.
 *
 * Strategy:
 *  1. Try the native Tauri save-dialog + fs write via @tauri-apps/plugin-dialog
 *     and @tauri-apps/plugin-fs (strict async/await, no promise chaining).
 *  2. If the dialog is cancelled, report 'cancelled' silently.
 *  3. On ANY other failure (browser dev mode, missing permissions, plugin
 *     unavailable) fall back to a web Blob download inside the catch block —
 *     never re-throws, so no unhandled-rejection / "reading 'catch'" errors.
 */
export async function saveBackupToDisk(jsonString: string): Promise<SaveMethod> {
  try {
    const dialog = await import('@tauri-apps/plugin-dialog');
    const fs = await import('@tauri-apps/plugin-fs');

    const filePath = await dialog.save({
      title: 'Save Backup Location',
      defaultPath: `thetodo-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!filePath) {
      // User pressed Cancel in the native dialog — not an error.
      return 'cancelled';
    }

    await fs.writeTextFile(filePath, jsonString);

    try {
      localStorage.setItem('thetodo-backup-path', filePath);
    } catch {
      /* non-fatal */
    }

    return 'tauri';
  } catch (error) {
    console.warn('Native save unavailable, falling back to browser download:', error);
    try {
      browserDownload(jsonString);
    } catch (downloadError) {
      console.error('Browser fallback download failed:', downloadError);
    }
    return 'browser';
  }
}
