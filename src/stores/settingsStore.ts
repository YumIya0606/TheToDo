import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  isAutoBackupEnabled: boolean;
  autoBackupPath: string | null;
  toggleAutoBackup: () => void;
  setAutoBackupPath: (path: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isAutoBackupEnabled: false,
      autoBackupPath: null,
      toggleAutoBackup: () => set((state) => ({ isAutoBackupEnabled: !state.isAutoBackupEnabled })),
      setAutoBackupPath: (path) => set({ autoBackupPath: path }),
    }),
    { name: 'thetodo-settings' }
  )
);