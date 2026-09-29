import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  isAutoBackupEnabled: boolean;
  autoBackupPath: string | null;
  /** Where ClassRadar writes its schedule export. */
  classRadarPath: string | null;
  /** When the Classes screen last read that file successfully. */
  classRadarCheckedAt: number | null;
  toggleAutoBackup: () => void;
  setAutoBackupPath: (path: string) => void;
  setClassRadarPath: (path: string) => void;
  markClassRadarChecked: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isAutoBackupEnabled: false,
      autoBackupPath: null,
      classRadarPath: null,
      classRadarCheckedAt: null,
      toggleAutoBackup: () => set((state) => ({ isAutoBackupEnabled: !state.isAutoBackupEnabled })),
      setAutoBackupPath: (path) => set({ autoBackupPath: path }),
      setClassRadarPath: (path) => set({ classRadarPath: path }),
      markClassRadarChecked: () => set({ classRadarCheckedAt: Date.now() }),
    }),
    { name: 'thetodo-settings' }
  )
);