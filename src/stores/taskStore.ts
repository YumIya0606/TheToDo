import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Priority, TaskStatus, Subtask } from '@/types';

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedSubtasks' | 'totalSubtasks'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksByPriority: (priority: Priority) => Task[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (data) => set((state) => ({
        tasks: [
          {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedSubtasks: 0,
            totalSubtasks: 0,
            subtasks: [],
          },
          ...state.tasks,
        ],
      })),

      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        ),
      })),

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      })),

      toggleTaskStatus: (id) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          const newStatus = t.status === 'completed' ? 'todo' : 'completed';
          return { ...t, status: newStatus, updatedAt: new Date().toISOString() };
        }),
      })),

      addSubtask: (taskId, title) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const newSubtask: Subtask = { id: generateId(), title, isCompleted: false };
          const newSubtasks = [...(t.subtasks || []), newSubtask];
          return {
            ...t,
            subtasks: newSubtasks,
            totalSubtasks: newSubtasks.length,
            completedSubtasks: newSubtasks.filter(s => s.isCompleted).length,
            updatedAt: new Date().toISOString(),
          };
        }),
      })),

      toggleSubtask: (taskId, subtaskId) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId || !t.subtasks) return t;
          const newSubtasks = t.subtasks.map(s =>
            s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
          );
          return {
            ...t,
            subtasks: newSubtasks,
            completedSubtasks: newSubtasks.filter(s => s.isCompleted).length,
            updatedAt: new Date().toISOString(),
          };
        }),
      })),

      deleteSubtask: (taskId, subtaskId) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId || !t.subtasks) return t;
          const newSubtasks = t.subtasks.filter(s => s.id !== subtaskId);
          return {
            ...t,
            subtasks: newSubtasks,
            totalSubtasks: newSubtasks.length,
            completedSubtasks: newSubtasks.filter(s => s.isCompleted).length,
            updatedAt: new Date().toISOString(),
          };
        }),
      })),

      getTasksByStatus: (status) => get().tasks.filter(t => t.status === status),
      getTasksByPriority: (priority) => get().tasks.filter(t => t.priority === priority),
    }),
    { name: 'thetodo-tasks-storage' }
  )
);