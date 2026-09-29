export interface BackupData {
  version: string;
  exportedAt: string;
  tasks: unknown;
  notes: unknown;
  diary: unknown;
  automation: unknown;
  settings: unknown;
}

export type SaveMethod = 'tauri' | 'browser' | 'cancelled';

const safeParse = (raw: string | null, fallback: unknown) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/** Aggregate all persisted Zustand/localStorage data into one backup object. */
export function collectBackupData(): BackupData {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    tasks: safeParse(localStorage.getItem('thetodo-task-storage'), []),
    notes: safeParse(localStorage.getItem('thetodo-notes'), []),
    diary: safeParse(localStorage.getItem('thetodo-diary-storage'), []),
    automation: safeParse(localStorage.getItem('thetodo-automation-jobs'), []),
    settings: safeParse(localStorage.getItem('thetodo-settings'), {}),
  };
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
  const keys: { field: keyof BackupData; storageKey: string; stateField: string }[] = [
    { field: 'tasks', storageKey: 'thetodo-task-storage', stateField: 'tasks' },
    { field: 'notes', storageKey: 'thetodo-notes', stateField: 'notes' },
    { field: 'diary', storageKey: 'thetodo-diary-storage', stateField: 'entries' },
    { field: 'automation', storageKey: 'thetodo-automation-jobs', stateField: 'jobs' },
    { field: 'settings', storageKey: 'thetodo-settings', stateField: '' },
  ];

  const restored: string[] = [];
  for (const { field, storageKey, stateField } of keys) {
    const value = data[field];
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
