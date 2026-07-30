export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'archived';
export type ViewMode = 'dashboard' | 'list' | 'kanban' | 'matrix';

export interface Subtask {
  id: string;
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
  subtasks?: Subtask[];
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}