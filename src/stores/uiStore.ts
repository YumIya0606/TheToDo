import { create } from 'zustand';
import { ViewMode } from '@/types';

type CurrentView = 
  | ViewMode 
  | 'notes' 
  | 'tags' 
  | 'settings' 
  | 'diary' 
  | 'import-export';

interface UIState {
  sidebarOpen: boolean;
  focusMode: boolean;
  currentView: CurrentView;
  
  // Modals
  isTaskModalOpen: boolean;
  isNoteModalOpen: boolean;
  isNewItemDropdownOpen: boolean;
  isNotificationModalOpen: boolean;
  isDiaryModalOpen: boolean;
  
  // Editing State
  editingTaskId: string | null;
  editingNoteId: string | null;
  editingDiaryId: string | null;
  
  // Theme
  theme: 'dark' | 'light';

  // Actions
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  setView: (view: CurrentView) => void;
  
  // Task Actions
  openTaskModal: (taskId?: string | null) => void;
  closeTaskModal: () => void;
  
  // Note Actions
  openNoteModal: (noteId?: string | null) => void;
  closeNoteModal: () => void;
  
  // Dropdown Actions
  openNewItemDropdown: () => void;
  closeNewItemDropdown: () => void;
  toggleNewItemDropdown: () => void; // This was missing or mismatched
  
  // Notification Actions
  openNotificationModal: () => void;
  closeNotificationModal: () => void;
  
  // Diary Actions
  openDiaryModal: (diaryId?: string | null) => void;
  closeDiaryModal: () => void;
  
  // Theme Actions
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  focusMode: false,
  currentView: 'dashboard',
  
  // Modals Initial State
  isTaskModalOpen: false,
  isNoteModalOpen: false,
  isNewItemDropdownOpen: false,
  isNotificationModalOpen: false,
  isDiaryModalOpen: false,
  
  // Editing Initial State
  editingTaskId: null,
  editingNoteId: null,
  editingDiaryId: null,
  
  // Theme Initial State
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setView: (view) => set({ currentView: view, isNewItemDropdownOpen: false }),
  
  openTaskModal: (taskId = null) => set({ 
    isTaskModalOpen: true, 
    editingTaskId: taskId,
    isNewItemDropdownOpen: false 
  }),
  closeTaskModal: () => set({ isTaskModalOpen: false, editingTaskId: null }),
  
  openNoteModal: (noteId = null) => set({
    isNoteModalOpen: true,
    editingNoteId: noteId,
    isNewItemDropdownOpen: false
  }),
  closeNoteModal: () => set({ isNoteModalOpen: false, editingNoteId: null }),
  
  openNewItemDropdown: () => set({ isNewItemDropdownOpen: true }),
  closeNewItemDropdown: () => set({ isNewItemDropdownOpen: false }),
  
  // This is the critical function causing your error
  toggleNewItemDropdown: () => set((state) => ({ isNewItemDropdownOpen: !state.isNewItemDropdownOpen })),
  
  openNotificationModal: () => set({ isNotificationModalOpen: true }),
  closeNotificationModal: () => set({ isNotificationModalOpen: false }),
  
  openDiaryModal: (diaryId = null) => set({
    isDiaryModalOpen: true,
    editingDiaryId: diaryId,
    isNewItemDropdownOpen: false
  }),
  closeDiaryModal: () => set({ isDiaryModalOpen: false, editingDiaryId: null }),
  
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));