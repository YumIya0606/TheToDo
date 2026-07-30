import { CheckCircle2, Circle, Calendar, Trash2, Edit2 } from 'lucide-react';
import { Task } from '@/types';
import { useTaskStore } from '@/stores/taskStore';
import { useUIStore } from '@/stores/uiStore';
import { Badge, Button } from '../ui/Button';
import { cn, getPriorityColor, formatDate } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  compact?: boolean;
}

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const { toggleTaskStatus, deleteTask } = useTaskStore();
  const { openTaskModal } = useUIStore();

  const progress = task.totalSubtasks > 0 
    ? Math.round((task.completedSubtasks / task.totalSubtasks) * 100) 
    : 0;

  return (
    <div className={cn(
      "group relative p-4 rounded-xl border bg-slate-900/40 hover:bg-slate-800/60 transition-all duration-200",
      task.status === 'completed' ? "border-slate-800 opacity-75" : "border-slate-700/50 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-900/10"
    )}>
      <div className="flex items-start gap-3">
        <button 
          onClick={() => toggleTaskStatus(task.id)}
          className={cn("mt-1 transition-colors", task.status === 'completed' ? "text-emerald-500" : "text-slate-600 hover:text-emerald-500")}
        >
          {task.status === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("font-semibold text-slate-200 truncate", task.status === 'completed' && "line-through text-slate-500")}>
              {task.title}
            </h3>
            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
          </div>
          
          {!compact && task.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-4 mt-3">
            {task.dueDate && (
              <div className={cn("flex items-center gap-1 text-xs", new Date(task.dueDate) < new Date() && task.status !== 'completed' ? "text-red-400" : "text-slate-500")}>
                <Calendar className="h-3 w-3" />
                {formatDate(task.dueDate)}
              </div>
            )}
            
            {task.totalSubtasks > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span>{task.completedSubtasks}/{task.totalSubtasks}</span>
              </div>
            )}

            <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTaskModal(task.id)}>
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => deleteTask(task.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {!compact && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {task.tags.map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-md">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}