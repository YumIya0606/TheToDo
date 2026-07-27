import React from 'react';
import { motion } from 'framer-motion';
import { Task, TaskStatus } from '@/types';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
];

export const KanbanView: React.FC = () => {
  const { tasks, updateTask } = useTaskStore();

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    updateTask(task.id, { status: newStatus });
  };

  return (
    <div className="h-full overflow-x-auto p-4">
      <div className="flex gap-4 min-w-max h-full">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);
          
          return (
            <motion.div
              key={column.id}
              layout
              className="w-80 flex flex-col bg-card/30 rounded-lg border border-white/10"
            >
              {/* Column Header */}
              <div className={cn(
                'p-3 border-b border-white/10 font-semibold',
                column.id === 'completed' ? 'text-emerald-400' :
                column.id === 'in_progress' ? 'text-blue-400' : 'text-foreground'
              )}>
                {column.title}
                <span className="ml-2 text-sm opacity-60">({columnTasks.length})</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggle={() => {
                      const nextStatus: TaskStatus = 
                        column.id === 'todo' ? 'in_progress' :
                        column.id === 'in_progress' ? 'completed' : 'todo';
                      handleStatusChange(task, nextStatus);
                    }}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
