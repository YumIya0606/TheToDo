import { CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from '../todo/TaskCard';
import { Card } from '../ui/Button';

export function DashboardView() {
  const { tasks } = useTaskStore();
  
  const stats = [
    { label: 'Total Tasks', value: tasks.length, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  const recentTasks = tasks.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-slate-400">Overview of your productivity and pending tasks.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6 flex items-center gap-4 hover:border-slate-600 transition-colors">
            <div className={`p-3 rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Recent Tasks</h3>
        <div className="grid gap-4">
          {recentTasks.length > 0 ? (
            recentTasks.map(task => <TaskCard key={task.id} task={task} />)
          ) : (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No tasks yet. Create one to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}