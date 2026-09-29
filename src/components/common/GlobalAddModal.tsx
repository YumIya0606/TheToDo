import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckSquare, FileText, BookOpen, Terminal, Moon, Plus, Tag as TagIcon, Pin } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { useAutomationStore } from '@/stores/automationStore';
import type { Priority, Subtask } from '@/types';
import { cn } from '@/lib/utils';

type Tab = 'task' | 'note' | 'diary' | 'automation' | 'silentboy';

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'task', label: 'Task', icon: CheckSquare },
  { key: 'note', label: 'Note', icon: FileText },
  { key: 'diary', label: 'Diary', icon: BookOpen },
  { key: 'automation', label: 'Automation Script', icon: Terminal },
  { key: 'silentboy', label: 'SilentBoy Lyric', icon: Moon },
];

const DIARY_MOODS = ['Sad', 'Reflective', 'Happy', 'Deep', 'Silent'] as const;

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all';

export function GlobalAddModal() {
  const { isUniversalModalOpen, closeUniversalModal, setView } = useUIStore();
  const { addTask } = useTaskStore();
  const { addNote } = useNoteStore();
  const { addEntry } = useDiaryStore();
  const { addJob } = useAutomationStore();

  const [tab, setTab] = useState<Tab>('task');

  // ── Task form ──────────────────────────────────────────────
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskDue, setTaskDue] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [taskTags, setTaskTags] = useState<string[]>([]);
  const [taskTagInput, setTaskTagInput] = useState('');

  // ── Note form ──────────────────────────────────────────────
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteFolder, setNoteFolder] = useState('');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [noteTagInput, setNoteTagInput] = useState('');
  const [notePinned, setNotePinned] = useState(false);

  // ── Diary form ─────────────────────────────────────────────
  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryContent, setDiaryContent] = useState('');
  const [diaryMood, setDiaryMood] = useState<typeof DIARY_MOODS[number]>('Silent');

  // ── Automation form ────────────────────────────────────────
  const [jobTitle, setJobTitle] = useState('');
  const [jobExecutor, setJobExecutor] = useState<'cmd' | 'powershell'>('cmd');
  const [jobPath, setJobPath] = useState('');
  const [jobCommand, setJobCommand] = useState('');
  const [jobArgs, setJobArgs] = useState('');

  if (!isUniversalModalOpen) return null;

  const resetAll = () => {
    setTaskTitle(''); setTaskDesc(''); setTaskPriority('medium'); setTaskDue(''); setTaskTime('');
    setIsScheduled(false); setTaskTags([]); setTaskTagInput('');
    setNoteTitle(''); setNoteContent(''); setNoteFolder(''); setNoteTags([]); setNoteTagInput(''); setNotePinned(false);
    setDiaryTitle(''); setDiaryContent(''); setDiaryMood('Silent');
    setJobTitle(''); setJobExecutor('cmd'); setJobPath(''); setJobCommand(''); setJobArgs('');
  };

  const handleClose = () => { closeUniversalModal(); resetAll(); };

  const handleTabSelect = (t: Tab) => {
    if (t === 'silentboy') {
      closeUniversalModal();
      setView('silentboy');
      return;
    }
    setTab(t);
  };

  const addTag = (list: string[], setter: (v: string[]) => void, input: string, clearInput: () => void) => {
    const v = input.trim();
    if (!v || list.includes(v)) return;
    setter([...list, v]);
    clearInput();
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    addTask({
      title: taskTitle.trim(),
      description: taskDesc || undefined,
      priority: taskPriority,
      category: 'General',
      tags: taskTags,
      subtasks: [] as Subtask[],
      dueDate: taskDue || undefined,
      dueTime: isScheduled ? taskTime || undefined : undefined,
      isScheduled,
      status: 'todo',
    });
    handleClose();
  };

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    addNote({
      title: notePinned ? `📌 ${noteTitle.trim()}` : noteTitle.trim(),
      content: noteContent,
      folder: noteFolder || 'Uncategorized',
      tags: noteTags,
    });
    handleClose();
  };

  const handleSubmitDiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaryContent.trim()) return;
    addEntry({
      title: diaryTitle.trim() || undefined,
      content: diaryContent,
      mood: diaryMood,
      date: new Date().toISOString(),
      isLocked: false,
    });
    handleClose();
  };

  const handleSubmitJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !jobPath.trim() || !jobCommand.trim()) return;
    addJob({ title: jobTitle.trim(), executor: jobExecutor, scriptPath: jobPath, command: jobCommand, args: jobArgs || undefined });
    handleClose();
  };

  const TagEditor = ({
    label, tags, input, onInputChange, onAdd, onRemove,
  }: {
    label: string; tags: string[]; input: string;
    onInputChange: (v: string) => void; onAdd: () => void; onRemove: (t: string) => void;
  }) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          className={inputCls}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
          placeholder="Add a tag and press Enter…"
        />
        <button type="button" onClick={onAdd} className="px-3 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-all flex-shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <TagIcon className="h-3 w-3" />
              {t}
              <button type="button" onClick={() => onRemove(t)} className="hover:text-red-400 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18 }}
          className="bg-[#0a1120]/90 backdrop-blur-2xl border border-slate-700 shadow-2xl max-w-3xl w-full rounded-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            <h2 className="text-base font-semibold text-white tracking-tight">Create New</h2>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Left nav */}
            <div className="w-48 flex-shrink-0 border-r border-white/10 p-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabSelect(key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left',
                    tab === key ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Dynamic content — scrollable, scrollbar hidden in Chrome & Firefox */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-5 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {tab === 'task' && (
                <form onSubmit={handleSubmitTask} className="space-y-4 pb-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title *</label>
                    <input className={inputCls} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title…" autoFocus required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                    <textarea className={cn(inputCls, 'min-h-[90px] resize-none')} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Details…" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
                      <select className={inputCls} value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as Priority)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Due Date</label>
                      <input type="date" className={cn(inputCls, '[color-scheme:dark]')} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">Is Scheduled</p>
                      <p className="text-xs text-slate-500">Notify me at a specific time</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScheduled((v) => !v)}
                      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isScheduled ? 'bg-cyan-600' : 'bg-slate-700')}
                    >
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', isScheduled ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>

                  {isScheduled && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Due Time</label>
                      <input type="time" className={cn(inputCls, '[color-scheme:dark]')} value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
                    </div>
                  )}

                  <TagEditor
                    label="Tags"
                    tags={taskTags}
                    input={taskTagInput}
                    onInputChange={setTaskTagInput}
                    onAdd={() => addTag(taskTags, setTaskTags, taskTagInput, () => setTaskTagInput(''))}
                    onRemove={(t) => setTaskTags(taskTags.filter((x) => x !== t))}
                  />

                  <button type="submit" className="btn-press w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 transition-all">
                    Create Task
                  </button>
                </form>
              )}

              {tab === 'note' && (
                <form onSubmit={handleSubmitNote} className="space-y-4 pb-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title *</label>
                    <input className={inputCls} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title…" autoFocus required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Content</label>
                    <textarea className={cn(inputCls, 'min-h-[140px] resize-none font-mono')} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your note…" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Folder</label>
                    <input className={inputCls} value={noteFolder} onChange={(e) => setNoteFolder(e.target.value)} placeholder="e.g., Personal, Work" />
                  </div>

                  <TagEditor
                    label="Tags"
                    tags={noteTags}
                    input={noteTagInput}
                    onInputChange={setNoteTagInput}
                    onAdd={() => addTag(noteTags, setNoteTags, noteTagInput, () => setNoteTagInput(''))}
                    onRemove={(t) => setNoteTags(noteTags.filter((x) => x !== t))}
                  />

                  <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Pin className="h-4 w-4 text-slate-400" />
                      <p className="text-sm text-slate-200 font-medium">Pin Note</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotePinned((v) => !v)}
                      className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', notePinned ? 'bg-cyan-600' : 'bg-slate-700')}
                    >
                      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', notePinned ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>

                  <button type="submit" className="btn-press w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 transition-all">
                    Create Note
                  </button>
                </form>
              )}

              {tab === 'diary' && (
                <form onSubmit={handleSubmitDiary} className="space-y-4 pb-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input className={inputCls} value={diaryTitle} onChange={(e) => setDiaryTitle(e.target.value)} placeholder="Today's heading…" autoFocus />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Mood</label>
                    <div className="flex flex-wrap gap-2">
                      {DIARY_MOODS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDiaryMood(m)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                            diaryMood === m
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                              : 'text-slate-500 border-white/10 hover:text-slate-300 hover:border-white/30'
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Content *</label>
                    <textarea
                      className={cn(inputCls, 'min-h-[200px] resize-none font-serif leading-relaxed')}
                      value={diaryContent}
                      onChange={(e) => setDiaryContent(e.target.value)}
                      placeholder="Dear diary…"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-press w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 transition-all">
                    Save Entry
                  </button>
                </form>
              )}

              {tab === 'automation' && (
                <form onSubmit={handleSubmitJob} className="space-y-4 pb-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Title *</label>
                    <input className={inputCls} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g., Daily Backup" autoFocus required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Executor</label>
                      <select className={inputCls} value={jobExecutor} onChange={(e) => setJobExecutor(e.target.value as 'cmd' | 'powershell')}>
                        <option value="cmd">Command Prompt</option>
                        <option value="powershell">PowerShell</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Script Path *</label>
                      <input className={inputCls} value={jobPath} onChange={(e) => setJobPath(e.target.value)} placeholder="C:\Scripts\backup.ps1" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Command *</label>
                    <input className={cn(inputCls, 'font-mono')} value={jobCommand} onChange={(e) => setJobCommand(e.target.value)} placeholder="python main.py" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Arguments (optional)</label>
                    <input className={cn(inputCls, 'font-mono')} value={jobArgs} onChange={(e) => setJobArgs(e.target.value)} placeholder="--verbose" />
                  </div>
                  <button type="submit" className="btn-press w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-semibold text-white hover:from-cyan-400 hover:to-blue-500 transition-all">
                    Create Job
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
