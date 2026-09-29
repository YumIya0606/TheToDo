import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task } from '@/types';

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedSubtasks' | 'totalSubtasks'>) => void;
  updateTask: (id: string, task: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  getTaskById: (id: string) => Task | undefined;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  markTaskNotified: (taskId: string) => void;
  clearCompleted: () => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      addTask: (task) => set((state) => {
        const totalSubtasks = task.subtasks?.length || 0;
        const completedSubtasks = task.subtasks?.filter(s => s.isCompleted).length || 0;
        return {
          tasks: [{ ...task, id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), totalSubtasks, completedSubtasks }, ...state.tasks],
        };
      }),
      updateTask: (id, updated) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== id) return t;
          let newTotal = t.totalSubtasks;
          let newCompleted = t.completedSubtasks;
          if (updated.subtasks) {
            newTotal = updated.subtasks.length;
            newCompleted = updated.subtasks.filter(s => s.isCompleted).length;
          }
          return { ...t, ...updated, totalSubtasks: newTotal, completedSubtasks: newCompleted, updatedAt: new Date().toISOString() };
        }),
      })),
      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
      getTaskById: (id) => get().tasks.find((t) => t.id === id),
      toggleSubtask: (taskId, subtaskId) => set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId || !t.subtasks) return t;
          const newSubtasks = t.subtasks.map((s) => s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s);
          return { ...t, subtasks: newSubtasks, completedSubtasks: newSubtasks.filter(s => s.isCompleted).length, totalSubtasks: newSubtasks.length, updatedAt: new Date().toISOString() };
        }),
      })),
      markTaskNotified: (taskId) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, notified: true, updatedAt: new Date().toISOString() } : t
        ),
      })),
      clearCompleted: () => set((state) => ({ tasks: state.tasks.filter((t) => t.status !== 'completed') })),
    }),
    { name: 'thetodo-task-storage' }
  )
);