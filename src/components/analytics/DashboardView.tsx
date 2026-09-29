import { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { InteractivePriorityBadge } from '../tasks/InteractivePriorityBadge';
import { cn } from '@/lib/utils';

export function DashboardView() {
  const { tasks } = useTaskStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'completed' | 'in_progress'>('all');

  const stats = [
    { label: 'Total Tasks', value: tasks.length, icon: TrendingUp, color: 'text-cyan-400' },
    { label: 'Completed', value: tasks.filter(t => t.status === 'completed').length, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, icon: Clock, color: 'text-blue-400' },
    { label: 'Urgent', value: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length, icon: AlertTriangle, color: 'text-red-400' },
  ];

  const filteredTasks = tasks
    .filter(t => filter === 'all' || (filter === 'urgent' ? t.priority === 'urgent' : t.status === filter))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Dashboard</h2>
        <p className="text-slate-400 mt-1">Overview of your productivity</p>
      </div>

      {/* Stats Grid - Reduced Height */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-3d h-28 p-4 rounded-2xl bg-[#0f2442]/50 border border-cyan-900/30 backdrop-blur-sm flex flex-col justify-between hover:border-cyan-500/30 group">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
              <stat.icon className={`icon-pop h-5 w-5 ${stat.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Tasks with Accordion */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-cyan-50">Recent Tasks</h3>
          <div className="flex gap-2">
            {['all', 'urgent', 'in_progress', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  filter === f 
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                    : "text-slate-400 hover:bg-slate-800"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-cyan-900/30 bg-[#0f2442]/20">
            <p className="text-slate-500">No tasks found. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <div key={task.id} className="group">
                {/* Main Row */}
                <div 
                  onClick={() => toggleExpand(task.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                    expandedId === task.id 
                      ? "bg-[#0f2442] border-cyan-500/30 shadow-[0_0_20px_-5px_rgba(6,182,212,0.15)]" 
                      : "bg-[#0f2442]/30 border-cyan-900/20 hover:border-cyan-500/20 hover:bg-[#0f2442]/50"
                  )}
                >
                  <InteractivePriorityBadge task={task} />
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium truncate">{task.title}</h4>
                    <p className="text-slate-400 text-xs truncate">{task.category} • {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {task.totalSubtasks > 0 && (
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-900/20 px-2 py-1 rounded">
                        {task.completedSubtasks}/{task.totalSubtasks}
                      </span>
                    )}
                    {expandedId === task.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === task.id && (
                  <div className="mt-2 ml-8 p-4 rounded-xl bg-[#060f1c] border border-cyan-900/30 animate-in slide-down fade-in duration-200">
                    {task.description && (
                      <p className="text-slate-300 text-sm mb-4 pb-4 border-b border-cyan-900/20">{task.description}</p>
                    )}
                    
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Subtasks</p>
                        {task.subtasks.map((subtask) => (
                          <label key={subtask.id} className="flex items-center gap-3 cursor-pointer group/subtask" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={subtask.isCompleted}
                              onChange={() => {
                                // Direct store update logic would go here via a prop passed from parent
                                // For now, visual only or requires lifting state up
                              }}
                              className="w-4 h-4 rounded border-cyan-900/50 bg-[#0a192f] text-cyan-500 focus:ring-cyan-500/50"
                            />
                            <span className={cn(
                              "text-sm transition-all",
                              subtask.isCompleted ? "text-slate-500 line-through" : "text-slate-300 group-hover/subtask:text-white"
                            )}>
                              {subtask.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}