import { CheckSquare, Trash2 } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { InteractivePriorityBadge } from '@/components/tasks/InteractivePriorityBadge';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: any;
  compact?: boolean;
}

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const { updateTask, deleteTask } = useTaskStore();

  const handleStatusToggle = () => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    updateTask(task.id, { status: newStatus });
  };

  return (
    <div className={cn(
      "group p-4 rounded-xl border transition-all duration-200 hover:shadow-lg",
      task.status === 'completed' 
        ? "bg-slate-900/50 border-slate-800 opacity-75" 
        : "bg-[#0f2442]/50 border-cyan-900/30 hover:border-cyan-500/50"
    )}>
      <div className="flex items-start gap-3">
        <InteractivePriorityBadge task={task} />
        
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-medium truncate transition-all",
            task.status === 'completed' ? "text-slate-500 line-through" : "text-white"
          )}>
            {task.title}
          </h4>
          
          {!compact && task.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{task.description}</p>
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500"
                  style={{ width: `${(task.completedSubtasks / task.totalSubtasks) * 100}%` }}
                />
              </div>
              <span>{task.completedSubtasks}/{task.totalSubtasks}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleStatusToggle}
            className={cn(
              "p-2 rounded-lg transition-colors",
              task.status === 'completed'
                ? "text-slate-500 hover:text-green-400 hover:bg-green-500/10"
                : "text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
            )}
          >
            <CheckSquare className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteTask(task.id)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}