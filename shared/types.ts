// Shared contract between server and UI. Keep in sync with db/schema.sql.

export type Subject = "combined_maths" | "physics" | "other";

export type ClassType =
  | "theory"
  | "speed"
  | "extra"
  | "revision"
  | "paper"
  | "booster"
  | "seminar"
  | "other";

export type MessageKind =
  | "class_announcement"
  | "class_reminder"
  | "postponement"
  | "cancellation"
  | "time_change"
  | "live_now"
  | "join_link"
  | "recording"
  | "material"
  | "paper"
  | "test"
  | "booster"
  | "question_set"
  | "result"
  | "fee_notice"
  | "general_notice"
  | "chat"
  | "reaction"
  | "irrelevant";

export type Urgency = "critical" | "high" | "normal" | "low";

export type StatusChange =
  | "scheduled"
  | "postponed"
  | "cancelled"
  | "rescheduled"
  | "started"
  | "completed";

export type LinkKind = "zoom" | "youtube" | "pdf" | "drive" | "form" | "website" | "tg" | "web";

export type TaskKind = "paper" | "test" | "video" | "attend" | "download" | "read" | "form";

export type SyncMode = "mtproto" | "webpreview" | "mixed" | "none";

export interface Channel {
  id: number;
  username: string;
  title: string;
  subject: Subject;
  teacher: string;
  kind: string;
  accent: string;
  enabled: number;
  last_sync_at: number | null;
  last_scanned_id: number;
  member_count: number | null;
  created_at: number;
}

export interface Message {
  id: number;
  channel_id: number;
  msg_id: number;
  date: number;
  edit_date: number | null;
  text: string;
  raw_text: string;
  has_media: number;
  media_kind: string | null;
  media_name: string | null;
  media_mime: string | null;
  media_size: number | null;
  media_ref: string | null;
  is_forwarded: number;
  forward_from: string | null;
  views: number | null;
  has_reply: number;
  reply_to_id: number | null;
  grouped_id: number | null;
  source: string;
  is_important: number;
  is_read: number;
  created_at: number;
  channel?: Pick<Channel, "username" | "title" | "subject" | "accent" | "kind">;
  analysis?: Analysis | null;
  /** Why the last AI attempt failed, when it did. Not a summary. */
  analysisError?: string | null;
  links?: Link[];
}

export interface Analysis {
  message_id: number;
  provider: string;
  model: string;
  prompt_version: string;
  kind: MessageKind;
  class_type: ClassType | null;
  subject: Subject | null;
  headline: string;
  detail: string;
  action: string | null;
  urgency: Urgency;
  status_change: StatusChange | null;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  confidence: number;
  raw_json: string | null;
  analyzed_at: number;
}

export interface Link {
  id: number;
  message_id: number;
  event_id: number | null;
  url: string;
  kind: LinkKind;
  label: string;
  host: string;
}

export interface ClassEvent {
  id: number;
  subject: Subject;
  class_type: ClassType;
  title: string;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  status: StatusChange;
  is_full_syllabus: number;
  is_exam_style: number;
  note: string;
  action: string | null;
  urgency: Urgency;
  confidence: number;
  created_at: number;
  updated_at: number;
  links?: Link[];
  sources?: EventSource[];
}

export interface EventSource {
  event_id: number;
  message_id: number;
  msg_id: number;
  channel_id: number;
  username: string;
  channel_title: string;
  date: number;
  text: string;
  kind: MessageKind | null;
  headline: string | null;
  detail: string | null;
  status_change: StatusChange | null;
}

export interface Task {
  id: number;
  message_id: number | null;
  event_id: number | null;
  subject: Subject;
  kind: TaskKind;
  title: string;
  note: string;
  due_date: string | null;
  due_time: string | null;
  done: number;
  created_at: number;
}

export interface SyncState {
  mode: SyncMode;
  authenticated: boolean;
  phone: string | null;
  channels: number;
  pendingAnalysis: number;
  lastError: string | null;
  lastRunAt: number | null;
  autoSyncEnabled: boolean;
  autoSyncMinutes: number;
}

export interface Dashboard {
  today: ClassEvent[];
  tomorrow: ClassEvent[];
  upcoming: ClassEvent[];
  openTasks: Task[];
  recentImportant: Message[];
  stats: {
    messages: number;
    /** Rows written, including rules-only fallbacks. */
    analyzed: number;
    /** Read by the model. This is what the UI calls "Understood". */
    understood: number;
    /** Sorted by simple rules only, so no class time was extracted. */
    rulesOnly: number;
    events: number;
    links: number;
    unanalyzed: number;
    awaitingAi: number;
    lastSync: number | null;
  };
}
