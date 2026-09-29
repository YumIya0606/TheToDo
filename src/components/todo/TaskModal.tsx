import { useState, useEffect } from 'react';
import { Plus, Trash2, CheckSquare, BookOpen, Clock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { UnifiedModal } from '../common/UnifiedModal';
import type { Priority, Subtask } from '@/types';
import { cn } from '@/lib/utils';

// ACADEMIC TEMPLATES CONFIGURATION
const ACADEMIC_TEMPLATES: Record<string, { tags: string[], subtasks: string[] }> = {
  'Chemistry': {
    tags: ['#Chemistry'],
    subtasks: ['Review Theory Concepts', 'Balance Equations (Oxidation Method)', 'Complete 15 MCQs', 'Solve Structured Questions']
  },
  'CombinedMaths': {
    tags: ['#CombinedMaths'],
    subtasks: ['Vector Algebra Proofs', 'Trigonometric Identities', 'Calculus Integration Problems', 'Statics Diagrams']
  },
  'Physics': {
    tags: ['#Physics'],
    subtasks: ['Derive Formulas', 'Solve Numerical Problems', 'Draw Ray Diagrams', 'Review Past Paper Section A']
  },
  'PythonScripts': {
    tags: ['#PythonScripts'],
    subtasks: ['Define Requirements', 'Write Core Logic', 'Debug & Test', 'Document Code']
  }
};

export function TaskModal() {
  const { isTaskModalOpen, closeTaskModal, editingTaskId } = useUIStore();
  const { addTask, updateTask, getTaskById } = useTaskStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [dueTime, setDueTime] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const editingTask = editingTaskId ? getTaskById(editingTaskId) : null;

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority);
      setCategory(editingTask.category);
      setDueDate(editingTask.dueDate || '');
      setIsScheduled(!!editingTask.isScheduled);
      setDueTime(editingTask.dueTime || '');
      setTags(editingTask.tags);
      setSubtasks(editingTask.subtasks || []);
    } else {
      resetForm();
    }
  }, [editingTask, isTaskModalOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setDueDate('');
    setIsScheduled(false);
    setDueTime('');
    setTags([]);
    setSubtasks([]);
    setSelectedTemplate('');
  };

  const applyTemplate = (templateName: string) => {
    const template = ACADEMIC_TEMPLATES[templateName];
    if (!template) return;
    
    setTags(prev => [...prev, ...template.tags.filter(t => !prev.includes(t))]);
    const newSubtasks = template.subtasks.map(title => ({
      id: Date.now().toString() + Math.random(),
      title,
      isCompleted: false
    }));
    setSubtasks(prev => [...prev, ...newSubtasks]);
    setSelectedTemplate(templateName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const completedCount = subtasks.filter(s => s.isCompleted).length;
    const taskData = {
      title,
      description,
      priority,
      category: category || 'General',
      tags,
      dueDate: dueDate || undefined,
      isScheduled,
      dueTime: isScheduled ? dueTime : undefined,
      subtasks,
      completedSubtasks: completedCount,
      totalSubtasks: subtasks.length,
    };

    if (editingTask) {
      updateTask(editingTask.id, { ...taskData, updatedAt: new Date().toISOString() });
    } else {
      addTask({ ...taskData, status: 'todo' });
    }
    closeTaskModal();
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { id: Date.now().toString(), title: newSubtask, isCompleted: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s));
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  return (
    <UnifiedModal
      isOpen={isTaskModalOpen}
      onClose={closeTaskModal}
      title={editingTask ? 'Edit Task' : 'Create New Task'}
      onSubmit={handleSubmit}
      submitLabel={editingTask ? 'Save Changes' : 'Create Task'}
    >
      <div className="space-y-4">
        {!editingTask && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-cyan-400 mb-2 uppercase tracking-wider">Academic Template</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.keys(ACADEMIC_TEMPLATES).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyTemplate(name)}
                  className={cn(
                    "p-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1",
                    selectedTemplate === name
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                      : "bg-[#060f1c] border-cyan-900/30 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200"
                  )}
                >
                  <BookOpen className="h-3 w-3" />
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder-slate-600"
            placeholder="What needs to be done?"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder-slate-600 min-h-[80px]"
            placeholder="Add details..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Scheduling Option */}
        <div className="p-4 rounded-lg bg-[#060f1c] border border-cyan-900/30">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              id="schedule-task"
              checked={isScheduled}
              onChange={e => setIsScheduled(e.target.checked)}
              className="w-4 h-4 rounded border-cyan-900/50 bg-[#0a192f] text-cyan-500 focus:ring-cyan-500/50"
            />
            <label htmlFor="schedule-task" className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Schedule Task (Time Notification)
            </label>
          </div>
          
          {isScheduled && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Notification Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full rounded-lg border border-cyan-900/50 bg-[#0a192f] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none [color-scheme:dark]"
              />
            </div>
          )}
        </div>

        {/* Subtasks with Fractional Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-400">
              Subtasks ({subtasks.filter(s=>s.isCompleted).length}/{subtasks.length})
            </label>
            {subtasks.length > 0 && (
              <div className="h-1.5 w-24 bg-cyan-900/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${subtasks.length ? (subtasks.filter(s=>s.isCompleted).length / subtasks.length) * 100 : 0}%` }}
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mb-3">
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
              placeholder="Add step..."
              className="flex-1 rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            />
            <button type="button" onClick={handleAddSubtask} className="p-2.5 rounded-lg bg-cyan-900/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
            {subtasks.map(subtask => (
              <div key={subtask.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#060f1c]/50 group hover:bg-[#060f1c] transition-colors">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSubtask(subtask.id); }}
                  className={cn(
                    "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all",
                    subtask.isCompleted 
                      ? "bg-cyan-500 border-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)]" 
                      : "border-cyan-900/50 hover:border-cyan-500/50"
                  )}
                >
                  {subtask.isCompleted && <CheckSquare className="h-3.5 w-3.5" />}
                </button>
                <span className={cn(
                  "text-sm flex-1 transition-all",
                  subtask.isCompleted ? "text-slate-500 line-through" : "text-slate-200"
                )}>
                  {subtask.title}
                </span>
                <button type="button" onClick={(e) => { e.stopPropagation(); removeSubtask(subtask.id); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </UnifiedModal>
  );
}