import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { showInAppToast } from '@/components/common/InAppToast';

export interface AutomationJob {
  id: string;
  title: string;
  executor: 'cmd' | 'powershell';
  scriptPath: string;
  command: string;
  args?: string;
  createdAt: string;
}

interface AutomationState {
  jobs: AutomationJob[];
  addJob: (job: Omit<AutomationJob, 'id' | 'createdAt'>) => void;
  deleteJob: (id: string) => void;
  updateJob: (id: string, job: Partial<AutomationJob>) => void;
  runJob: (id: string) => Promise<boolean>;
}

export const useAutomationStore = create<AutomationState>()(
  persist(
    (set, get) => ({
      jobs: [],
      addJob: (job) => set((state) => ({
        jobs: [{
          ...job,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        }, ...state.jobs],
      })),
      deleteJob: (id) => set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
      })),
      updateJob: (id, updated) => set((state) => ({
        jobs: state.jobs.map((j) => j.id === id ? { ...j, ...updated } : j),
      })),
      runJob: async (id) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return false;

        try {
          if (job.executor === 'powershell' && !job.scriptPath.toLowerCase().endsWith('.ps1')) {
            showInAppToast('Please select the actual .ps1 file, not a folder.');
            return false;
          }
          await invoke('run_native_script', {
            executor: job.executor,
            scriptPath: job.scriptPath,
          });
          return true;
        } catch (error) {
          console.error('Error running job:', error);
          return false;
        }
      }
    }),
    { name: 'thetodo-automation-jobs' }
  )
);
