import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { TaskStatus } from '@/types';

const columns: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
];

export function KanbanView() {
  const { getTasksByStatus } = useTaskStore();

  return (
    <div className="h-full overflow-x-auto pb-4 animate-in fade-in duration-500">
      <div className="flex gap-6 min-w-[1000px]">
        {columns.map(col => {
          const tasks = getTasksByStatus(col.id);
          return (
            <div key={col.id} className="flex-1 min-w-[300px]">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-semibold text-slate-200">{col.label}</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">{tasks.length}</span>
              </div>
              <div className="space-y-3">
                {tasks.map(task => <TaskCard key={task.id} task={task} compact />)}
                {tasks.length === 0 && (
                  <div className="h-32 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-600 text-sm">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}