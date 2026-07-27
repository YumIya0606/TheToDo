import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { Task, Priority, TaskStatus, Subtask } from '@/types';
import { useTaskStore } from '@/stores/taskStore';
import { Button, Input, Card, CardHeader, CardContent } from './ui/Button';
import { cn } from '@/lib/utils';

interface TaskModalProps {
  task?: Task | null;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, onClose }) => {
  const { addTask, updateTask, addSubtask, toggleSubtask, deleteSubtask } = useTaskStore();
  
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo');
  const [category, setCategory] = useState(task?.category || 'General');
  const [tags, setTags] = useState(task?.tags.join(', ') || '');
  const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
    
    if (task) {
      updateTask(task.id, {
        title,
        description,
        priority,
        status,
        category,
        tags: tagArray,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
    } else {
      addTask({
        title,
        description,
        priority,
        status,
        category,
        tags: tagArray,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
    }
    
    onClose();
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim() || !task) return;
    addSubtask(task.id, { taskId: task.id, title: newSubtaskTitle, isCompleted: false });
    setNewSubtaskTitle('');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-card border-white/20">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/10">
              <h2 className="text-xl font-semibold">{task ? 'Edit Task' : 'New Task'}</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter task description"
                    className="w-full min-h-[100px] rounded-md border border-white/20 bg-card px-3 py-2 text-sm text-foreground placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                {/* Priority & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                      className="w-full rounded-md border border-white/20 bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskStatus)}
                      className="w-full rounded-md border border-white/20 bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Category & Tags */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <Input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Work, Personal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tags</label>
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                {/* Subtasks */}
                {task && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Subtasks</label>
                    <div className="space-y-2 mb-2">
                      {task.subtasks?.map((subtask) => (
                        <div key={subtask.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={subtask.isCompleted}
                            onChange={() => toggleSubtask(task.id, subtask.id)}
                            className="rounded border-white/30"
                          />
                          <span className={cn(
                            'flex-1 text-sm',
                            subtask.isCompleted && 'line-through text-gray-500'
                          )}>
                            {subtask.title}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteSubtask(task.id, subtask.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="New subtask"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                      />
                      <Button type="button" size="sm" onClick={handleAddSubtask}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit">{task ? 'Update' : 'Create'} Task</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
