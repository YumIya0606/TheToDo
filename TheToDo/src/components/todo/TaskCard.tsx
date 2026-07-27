import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle } from 'lucide-react';
import { Task, Subtask } from '@/types';
import { cn, getPriorityColor, getStatusColor, calculateProgress, formatDate } from '@/lib/utils';
import { Card, Badge } from './ui/Button';

interface TaskCardProps {
  task: Task;
  onToggle?: (id: string) => void;
  onClick?: (task: Task) => void;
  compact?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onClick, compact }) => {
  const progress = calculateProgress(task.completedSubtasks, task.totalSubtasks);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group cursor-pointer rounded-lg border border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 hover:bg-card',
        task.status === 'completed' && 'opacity-60'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(task.id);
          }}
          className={cn(
            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all',
            task.status === 'completed'
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-white/30 hover:border-white/50'
          )}
        >
          {task.status === 'completed' && <Check className="h-3.5 w-3.5" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn(
              'font-medium text-foreground truncate',
              task.status === 'completed' && 'line-through text-gray-500'
            )}>
              {task.title}
            </h3>
            
            {/* Priority Badge */}
            <Badge className={cn('shrink-0', getPriorityColor(task.priority))}>
              {task.priority}
            </Badge>

            {/* Status Badge */}
            {task.status !== 'todo' && (
              <Badge className={cn('shrink-0', getStatusColor(task.status))}>
                {task.status.replace('_', ' ')}
              </Badge>
            )}
          </div>

          {task.description && !compact && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">{task.description}</p>
          )}

          {/* Tags */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.map((tag) => (
                <span key={tag} className="text-xs text-accent">#{tag}</span>
              ))}
            </div>
          )}

          {/* Subtask Progress */}
          {task.totalSubtasks > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {task.completedSubtasks}/{task.totalSubtasks}
              </span>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {task.dueDate && (
              <span>{formatDate(task.dueDate)}</span>
            )}
            <span>{task.category}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface TaskListProps {
  tasks: Task[];
  onToggleTask?: (id: string) => void;
  onTaskClick?: (task: Task) => void;
  emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onToggleTask, 
  onTaskClick,
  emptyMessage = 'No tasks found'
}) => {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Circle className="h-12 w-12 mb-3 opacity-20" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onToggle={onToggleTask}
            onClick={onTaskClick}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
