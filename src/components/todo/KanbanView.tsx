import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { PageHeader } from '../common/PageHeader';

const columns = [
  { id: 'todo', title: 'To Do', color: 'border-slate-500' },
  { id: 'in_progress', title: 'In Progress', color: 'border-cyan-500' },
  { id: 'completed', title: 'Completed', color: 'border-green-500' },
];

export function KanbanView() {
  const { tasks } = useTaskStore();

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Kanban Board" 
        subtitle="Track task progression" 
      />

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 h-full min-w-[1000px]">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="flex-1 flex flex-col bg-[#0f2442]/30 rounded-xl border border-slate-800/50">
                <div className={`p-4 border-b border-slate-800/50 border-t-4 ${col.color} rounded-t-xl`}>
                  <h3 className="font-semibold text-white">{col.title}</h3>
                  <span className="text-xs text-slate-500">{colTasks.length} tasks</span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} compact />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}