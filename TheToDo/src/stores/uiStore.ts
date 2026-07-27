import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  focusMode: boolean;
  currentView: 'list' | 'kanban' | 'matrix';
  searchQuery: string;
  selectedTaskId: string | null;
  selectedNoteId: string | null;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  setView: (view: 'list' | 'kanban' | 'matrix') => void;
  setSearchQuery: (query: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      focusMode: false,
      currentView: 'list',
      searchQuery: '',
      selectedTaskId: null,
      selectedNoteId: null,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      
      setView: (view) => set({ currentView: view }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      
      setSelectedNoteId: (id) => set({ selectedNoteId: id }),
    }),
    {
      name: 'thetodo-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        sidebarOpen: state.sidebarOpen, 
        currentView: state.currentView,
        focusMode: state.focusMode 
      }),
    }
  )
);
