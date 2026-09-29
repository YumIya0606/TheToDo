import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DiaryEntry {
  id: string;
  title?: string;
  content: string;
  date: string;
  isLocked: boolean;
  passwordHash?: string; // In real app, use proper hashing
  mood?: 'Sad' | 'Reflective' | 'Silent' | 'Deep' | 'Happy' | null;
  fontStyle?: 'serif' | 'mono' | 'sans' | null;
  createdAt: string;
  updatedAt: string;
}

interface DiaryState {
  entries: DiaryEntry[];
  addEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEntry: (id: string, entry: Partial<DiaryEntry>) => void;
  deleteEntry: (id: string) => void;
  getEntryById: (id: string) => DiaryEntry | undefined;
}

export const useDiaryStore = create<DiaryState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (entry) => set((state) => ({
        entries: [{
          ...entry,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, ...state.entries],
      })),
      updateEntry: (id, updated) => set((state) => ({
        entries: state.entries.map((e) =>
          e.id === id ? { ...e, ...updated, updatedAt: new Date().toISOString() } : e
        ),
      })),
      deleteEntry: (id) => set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      })),
      getEntryById: (id) => get().entries.find((e) => e.id === id),
    }),
    { name: 'thetodo-diary-storage' }
  )
);