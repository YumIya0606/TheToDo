export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'archived';
export type ViewMode = 'dashboard' | 'list' | 'kanban' | 'matrix';
export type CurrentView = 
  | ViewMode 
  | 'notes' 
  | 'tags' 
  | 'settings' 
  | 'diary' 
  | 'silentboy'
  | 'planner'
  | 'boosters'
  | 'automation';

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
  isScheduled?: boolean;
  dueTime?: string; // Format "HH:mm"
  notified?: boolean; // Track if notification already sent
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

export interface DiaryEntry {
  id: string;
  title?: string;
  content: string;
  date: string;
  isLocked: boolean;
  passwordHash?: string;
  mood?: 'Sad' | 'Reflective' | 'Silent' | 'Deep' | 'Happy' | null;
  fontStyle?: 'serif' | 'mono' | 'sans' | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationJob {
  id: string;
  title: string;
  executor: 'cmd' | 'powershell';
  scriptPath: string;
  command: string;
  args?: string;
  createdAt: string;
}

/** A recurring time block that occupies part of a day (school, class, sleep, …). */
export interface Commitment {
  id: string;
  label: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm" — may be earlier than startTime (overnight, e.g. sleep)
  days: number[];    // 0 = Sunday … 6 = Saturday
  preset?: boolean;  // true when created by the onboarding wizard (still fully editable)
}

/** A recurring "study X now" reminder tied to a subject. */
export interface StudyReminder {
  id: string;
  subject: string;
  time: string;      // "HH:mm"
  message?: string;
  lastFiredDate?: string; // "YYYY-MM-DD" — ensures it fires once per day
}

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}