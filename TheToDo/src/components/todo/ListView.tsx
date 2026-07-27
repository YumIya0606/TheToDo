import React from 'react';
import { motion } from 'framer-motion';
import { Task, TaskStatus } from '@/types';
import { useTaskStore } from '@/stores/taskStore';
import { TaskList } from './TaskCard';

interface ListViewProps {
  statusFilter?: TaskStatus;
}

export const ListView: React.FC<ListViewProps> = ({ statusFilter }) => {
  const { tasks, updateTask } = useTaskStore();

  const filteredTasks = statusFilter
    ? tasks.filter((task) => task.status === statusFilter)
    : tasks;

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const newStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
      updateTask(taskId, { status: newStatus });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <TaskList
        tasks={filteredTasks}
        onToggleTask={handleToggleTask}
        emptyMessage={statusFilter ? `No ${statusFilter.replace('_', ' ')} tasks` : 'No tasks yet'}
      />
    </div>
  );
};
