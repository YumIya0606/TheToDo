export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'archived';

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  category: string;
  tags: string[];
  completedSubtasks: number;
  totalSubtasks: number;
  linkedNoteId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: Subtask[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViewMode {
  type: 'list' | 'kanban' | 'matrix';
}

export interface AppState {
  currentView: ViewMode['type'];
  sidebarOpen: boolean;
  focusMode: boolean;
  searchQuery: string;
}
