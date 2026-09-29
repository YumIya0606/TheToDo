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
  | 'classes'
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

/**
 * How often a commitment actually recurs.
 *
 * Several tuition classes run on alternate weeks rather than every week. Treating
 * them as weekly would quietly understate free time on every off week, so the
 * planner needs to know which is which.
 */
export type Cadence = 'weekly' | 'fortnightly';

/** A recurring time block that occupies part of a day (school, class, sleep, …). */
export interface Commitment {
  id: string;
  label: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm" — may be earlier than startTime (overnight, e.g. sleep)
  days: number[];    // 0 = Sunday … 6 = Saturday
  preset?: boolean;  // true when created by the onboarding wizard (still fully editable)
  /** Defaults to weekly when absent, so older saved data keeps its meaning. */
  cadence?: Cadence;
  /**
   * Anchor date (YYYY-MM-DD) for a fortnightly commitment: the week containing
   * this date is an "on" week. Without an anchor a fortnightly class cannot be
   * placed, so those commitments are treated as on for the current week.
   */
  anchorDate?: string;
  /** Which subject this block belongs to, when it is a class rather than sleep. */
  subject?: string;
  /** Set when the block came from ClassRadar rather than being typed by hand. */
  source?: 'manual' | 'classradar';
  /** Whether this week is the "off" week for a fortnightly class. */
  offThisWeek?: boolean;
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