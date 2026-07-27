import React from 'react';
import { motion } from 'framer-motion';
import { Task, Priority } from '@/types';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { cn, getPriorityColor } from '@/lib/utils';

const priorities: Priority[] = ['urgent', 'high', 'medium', 'low'];

export const MatrixView: React.FC = () => {
  const { tasks } = useTaskStore();

  // Eisenhower Matrix: Urgent/Important quadrants
  const getQuadrant = (task: Task): number => {
    const isUrgent = task.priority === 'urgent' || task.priority === 'high';
    const isImportant = task.priority === 'urgent' || task.priority === 'medium';
    
    if (isUrgent && isImportant) return 0; // Do First
    if (!isUrgent && isImportant) return 1; // Schedule
    if (isUrgent && !isImportant) return 2; // Delegate
    return 3; // Eliminate
  };

  const quadrants = [
    { title: 'Do First', description: 'Urgent & Important', color: 'text-red-400 border-red-500/30 bg-red-500/5' },
    { title: 'Schedule', description: 'Not Urgent & Important', color: 'text-blue-400 border-blue-500/30 bg-blue-500/5' },
    { title: 'Delegate', description: 'Urgent & Not Important', color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5' },
    { title: 'Eliminate', description: 'Not Urgent & Not Important', color: 'text-gray-400 border-gray-500/30 bg-gray-500/5' },
  ];

  return (
    <div className="h-full p-4 overflow-auto">
      <div className="grid grid-cols-2 gap-4 h-full min-h-[600px]">
        {quadrants.map((quadrant, index) => {
          const quadrantTasks = tasks.filter((task) => getQuadrant(task) === index);

          return (
            <motion.div
              key={index}
              layout
              className={cn(
                'rounded-lg border p-4 flex flex-col',
                quadrant.color
              )}
            >
              <div className="mb-3">
                <h3 className={cn('font-bold text-lg', quadrant.color.split(' ')[0])}>
                  {quadrant.title}
                </h3>
                <p className="text-xs opacity-70">{quadrant.description}</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {quadrantTasks.length === 0 ? (
                  <div className="text-sm opacity-50 py-8 text-center">No tasks</div>
                ) : (
                  quadrantTasks.map((task) => (
                    <TaskCard key={task.id} task={task} compact />
                  ))
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
