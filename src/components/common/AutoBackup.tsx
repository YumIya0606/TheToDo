import { useEffect } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDiaryStore } from '@/stores/diaryStore';

// Dynamic import to prevent build errors if plugin is missing
let fsPlugin: any = null;
const loadFS = async () => {
  if (!fsPlugin) {
    try {
      const fs = await import('@tauri-apps/plugin-fs');
      fsPlugin = { writeTextFile: fs.writeTextFile };
    } catch (e) { console.warn("Auto-backup disabled: FS plugin missing"); }
  }
};

export function AutoBackup() {
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const { entries } = useDiaryStore();

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const backupPath = localStorage.getItem('thetodo-backup-path');
      if (backupPath && fsPlugin) {
        try {
          const data = { tasks, notes, diaryEntries: entries, exportDate: new Date().toISOString(), isAutoBackup: true };
          await fsPlugin.writeTextFile(backupPath, JSON.stringify(data, null, 2));
          console.log('Auto-backup saved');
        } catch (e) { console.error('Auto-backup failed', e); }
      }
    };

    // Load plugin early
    loadFS();

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tasks, notes, entries]);

  return null;
}