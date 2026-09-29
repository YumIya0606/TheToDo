import { create } from 'zustand';

// Define the view types explicitly to avoid import conflicts and ensure all views are covered
type CurrentView = 
  | 'dashboard' 
  | 'list' 
  | 'kanban' 
  | 'matrix' 
  | 'notes' 
  | 'tags' 
  | 'diary' 
  | 'silentboy'
  | 'planner'
  | 'boosters'
  | 'settings' 
  | 'automation';

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
  isAutomationModalOpen: boolean; // New state for Unified Automation Modal
  isUniversalModalOpen: boolean;  // Universal Create modal
  
  // Editing State
  editingTaskId: string | null;
  editingNoteId: string | null;
  editingDiaryId: string | null;
  editingAutomationId: string | null; // New state for editing automation jobs
  
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
  toggleNewItemDropdown: () => void;
  
  // Notification Actions
  openNotificationModal: () => void;
  closeNotificationModal: () => void;
  
  // Diary Actions
  openDiaryModal: (diaryId?: string | null) => void;
  closeDiaryModal: () => void;
  
  // Automation Actions
  openAutomationModal: (jobId?: string | null) => void;
  closeAutomationModal: () => void;

  // Universal Create Modal Actions
  openUniversalModal: () => void;
  closeUniversalModal: () => void;
  
  // Theme Actions
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  focusMode: false,
  currentView: 'dashboard',
  
  isTaskModalOpen: false,
  isNoteModalOpen: false,
  isNewItemDropdownOpen: false,
  isNotificationModalOpen: false,
  isDiaryModalOpen: false,
  isAutomationModalOpen: false,
  isUniversalModalOpen: false,
  
  editingTaskId: null,
  editingNoteId: null,
  editingDiaryId: null,
  editingAutomationId: null,
  
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setView: (view) => set({ 
    currentView: view, 
    isNewItemDropdownOpen: false,
    // Close modals when switching views to prevent state leaks
    isTaskModalOpen: false,
    isNoteModalOpen: false,
    isDiaryModalOpen: false,
    isAutomationModalOpen: false
  }),
  
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
  toggleNewItemDropdown: () => set((state) => ({ isNewItemDropdownOpen: !state.isNewItemDropdownOpen })),
  
  openNotificationModal: () => set({ isNotificationModalOpen: true }),
  closeNotificationModal: () => set({ isNotificationModalOpen: false }),
  
  openDiaryModal: (diaryId = null) => set({
    isDiaryModalOpen: true,
    editingDiaryId: diaryId,
    isNewItemDropdownOpen: false
  }),
  closeDiaryModal: () => set({ isDiaryModalOpen: false, editingDiaryId: null }),

  openAutomationModal: (jobId = null) => set({
    isAutomationModalOpen: true,
    editingAutomationId: jobId,
    isNewItemDropdownOpen: false
  }),
  closeAutomationModal: () => set({ isAutomationModalOpen: false, editingAutomationId: null }),

  openUniversalModal: () => set({ isUniversalModalOpen: true, isNewItemDropdownOpen: false }),
  closeUniversalModal: () => set({ isUniversalModalOpen: false }),
  
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
}));