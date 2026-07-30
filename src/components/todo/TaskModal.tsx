import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Flag, Tag as TagIcon, Plus, Trash2, CheckSquare } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { Button, Input } from '../ui/Button';
import { cn } from '@/lib/utils';
import type { Priority, Subtask } from '@/types';

interface TaskModalProps {
  onClose?: () => void;
}

export function TaskModal({ onClose }: TaskModalProps) {
  const { isTaskModalOpen, closeTaskModal, editingTaskId } = useUIStore();
  const { tasks, addTask, updateTask, getTaskById } = useTaskStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const editingTask = editingTaskId ? getTaskById(editingTaskId) : null;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeTaskModal();
        onClose?.();
      }
    };

    if (isTaskModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTaskModalOpen, closeTaskModal, onClose]);

  // Populate form when editing
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority);
      setCategory(editingTask.category);
      setDueDate(editingTask.dueDate || '');
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
    setTags([]);
    setSubtasks([]);
    setNewTag('');
    setNewSubtask('');
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
      subtasks,
      completedSubtasks: completedCount,
      totalSubtasks: subtasks.length,
    };

    if (editingTask) {
      updateTask(editingTask.id, { ...taskData, updatedAt: new Date().toISOString() });
    } else {
      addTask({
        ...taskData,
        status: 'todo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    closeTaskModal();
    onClose?.();
  };

  const handleAddTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;
    setTags([...tags, newTag.trim()]);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
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

  if (!isTaskModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center justify-between sticky top-0 bg-slate-900 pb-4 border-b border-slate-800 z-10">
            <h2 className="text-xl font-bold text-white">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
            <button type="button" onClick={() => { closeTaskModal(); onClose?.(); }} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="What needs to be done?" 
                required 
                autoFocus 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[100px]"
                placeholder="Add details..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as Priority)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Due Date</label>
                <Input 
                  type="date" 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)} 
                  className="bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
              <Input 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                placeholder="e.g., Work, Personal, Shopping" 
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Tags</label>
              <div className="flex gap-2 mb-3">
                <Input 
                  value={newTag} 
                  onChange={e => setNewTag(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} 
                  placeholder="Add a tag..." 
                  className="flex-1 bg-slate-950"
                />
                <Button type="button" onClick={handleAddTag} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      <TagIcon className="h-3 w-3" />
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Subtasks</label>
              <div className="flex gap-2 mb-3">
                <Input 
                  value={newSubtask} 
                  onChange={e => setNewSubtask(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())} 
                  placeholder="Add a subtask..." 
                  className="flex-1 bg-slate-950"
                />
                <Button type="button" onClick={handleAddSubtask} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {subtasks.length > 0 && (
                <div className="space-y-2">
                  {subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 group">
                      <button
                        type="button"
                        onClick={() => toggleSubtask(subtask.id)}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                          subtask.isCompleted 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-slate-600 hover:border-emerald-500"
                        )}
                      >
                        {subtask.isCompleted && <CheckSquare className="h-3.5 w-3.5" />}
                      </button>
                      <span className={cn(
                        "text-sm flex-1",
                        subtask.isCompleted ? "text-slate-500 line-through" : "text-slate-200"
                      )}>
                        {subtask.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(subtask.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <Button type="button" variant="ghost" onClick={() => { closeTaskModal(); onClose?.(); }}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}