import { useMemo, useState } from 'react';
import { Search, CalendarClock, User } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { Input } from '../ui/Button';
import { cn } from '@/lib/utils';

/**
 * Task list.
 *
 * A class is not a task. Your timetable is in the planner as a recurring
 * commitment; what a class creates is dated work. Splitting the two here is what
 * stops a busy week of tuition reading as a week of chores.
 */
export function ListView() {
  const tasks = useTaskStore((s) => s.tasks);
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'class' | 'mine'>('all');

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (scope === 'class' && task.origin !== 'class') return false;
      if (scope === 'mine' && task.origin === 'class') return false;
      if (!q) return true;
      return (
        task.title.toLowerCase().includes(q) ||
        (task.description ?? '').toLowerCase().includes(q) ||
        (task.relatedClass ?? '').toLowerCase().includes(q)
      );
    });
  }, [tasks, searchQuery, scope]);

  const fromClass = tasks.filter((t) => t.origin === 'class').length;

  const scopes: Array<{ id: typeof scope; label: string; icon: typeof Search; count: number }> = [
    { id: 'all', label: 'All', icon: Search, count: tasks.length },
    { id: 'class', label: 'From classes', icon: CalendarClock, count: fromClass },
    { id: 'mine', label: 'Mine', icon: User, count: tasks.length - fromClass },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-bold text-white">Tasks</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Where something came from, not just what it is. */}
      <div className="flex items-center gap-1.5">
        {scopes.map((s) => {
          const Icon = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setScope(s.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                active
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15'
              )}
            >
              <Icon className="h-3 w-3" />
              {s.label}
              <span className="text-[9px] opacity-60 tabular-nums">{s.count}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        ) : (
          <div className="text-center py-12 text-slate-500">
            {tasks.length === 0
              ? 'Nothing here yet. Add a task, or send work from your classes in from the Classes screen.'
              : 'Nothing matches.'}
          </div>
        )}
      </div>
    </div>
  );
}
