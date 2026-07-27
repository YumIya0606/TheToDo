import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, Subtask, Priority, TaskStatus } from '@/types';

interface TaskState {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedSubtasks' | 'totalSubtasks'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addSubtask: (taskId: string, subtask: Omit<Subtask, 'id'>) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksByPriority: (priority: Priority) => Task[];
  searchTasks: (query: string) => Task[];
}

const generateId = () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedSubtasks: 0,
          totalSubtasks: 0,
        };
        set((state) => ({ tasks: [...state.tasks, newTask] }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));
      },

      addSubtask: (taskId, subtaskData) => {
        const subtask: Subtask = {
          ...subtaskData,
          id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id === taskId) {
              const updatedSubtasks = [...(task.subtasks || []), subtask];
              return {
                ...task,
                subtasks: updatedSubtasks,
                totalSubtasks: updatedSubtasks.length,
                completedSubtasks: updatedSubtasks.filter((s) => s.isCompleted).length,
                updatedAt: new Date().toISOString(),
              };
            }
            return task;
          }),
        }));
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id === taskId) {
              const updatedSubtasks = (task.subtasks || []).map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, isCompleted: !subtask.isCompleted } : subtask
              );
              return {
                ...task,
                subtasks: updatedSubtasks,
                completedSubtasks: updatedSubtasks.filter((s) => s.isCompleted).length,
                updatedAt: new Date().toISOString(),
              };
            }
            return task;
          }),
        }));
      },

      deleteSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id === taskId) {
              const updatedSubtasks = (task.subtasks || []).filter((s) => s.id !== subtaskId);
              return {
                ...task,
                subtasks: updatedSubtasks,
                totalSubtasks: updatedSubtasks.length,
                completedSubtasks: updatedSubtasks.filter((s) => s.isCompleted).length,
                updatedAt: new Date().toISOString(),
              };
            }
            return task;
          }),
        }));
      },

      getTasksByStatus: (status) => {
        return get().tasks.filter((task) => task.status === status);
      },

      getTasksByPriority: (priority) => {
        return get().tasks.filter((task) => task.priority === priority);
      },

      searchTasks: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().tasks.filter(
          (task) =>
            task.title.toLowerCase().includes(lowerQuery) ||
            task.description?.toLowerCase().includes(lowerQuery) ||
            task.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
      },
    }),
    {
      name: 'thetodo-tasks',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
