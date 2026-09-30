import { memo } from 'react';
import { CalendarClock, CheckSquare, Trash2 } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { InteractivePriorityBadge } from '@/components/tasks/InteractivePriorityBadge';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: any;
  compact?: boolean;
}

export const TaskCard = memo(function TaskCard({ task, compact = false }: TaskCardProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

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
            {/* Where this came from. A class is not a task, so work a class
                creates says which class, and the class itself stays in the
                planner as the recurring thing it is. */}
            {task.origin === 'class' && (
              <span
                className="inline-flex items-center gap-1 mb-1 px-1.5 py-px rounded text-[9px]
                           bg-cyan-500/12 text-cyan-300/90 border border-cyan-500/20 max-w-full"
                title="This work came from a class in your timetable"
              >
                <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{task.relatedClass ?? 'From a class'}</span>
              </span>
            )}
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
});
