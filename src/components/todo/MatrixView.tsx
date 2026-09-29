import { AlertCircle, Clock, CheckCircle2, Zap } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { PageHeader } from '../common/PageHeader';
import { TaskCard } from './TaskCard';
import type { Priority } from '@/types';

const quadrants = [
  { id: 'urgent-important', label: 'Do First', sub: 'Urgent & Important', priorities: ['urgent', 'high'] as Priority[], urgent: true },
  { id: 'not-urgent-important', label: 'Schedule', sub: 'Not Urgent & Important', priorities: ['medium'] as Priority[], urgent: false },
  { id: 'urgent-not-important', label: 'Delegate', sub: 'Urgent & Not Important', priorities: ['urgent', 'high'] as Priority[], urgent: true },
  { id: 'not-urgent-not-important', label: 'Eliminate', sub: 'Not Urgent & Not Important', priorities: ['low'] as Priority[], urgent: false },
];

export function MatrixView() {
  const { tasks } = useTaskStore();

  const getIcon = (q: any) => {
    if (q.urgent && q.priorities.includes('urgent')) return <Zap className="h-5 w-5 text-red-400" />;
    if (!q.urgent && q.priorities.includes('medium')) return <Clock className="h-5 w-5 text-blue-400" />;
    if (q.urgent && !q.priorities.includes('urgent')) return <AlertCircle className="h-5 w-5 text-yellow-400" />;
    return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Eisenhower Matrix" 
        subtitle="Prioritize your academic tasks" 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quadrants.map((q) => {
          const quadrantTasks = tasks.filter(t => 
            q.priorities.includes(t.priority) && 
            t.status !== 'completed' && 
            t.status !== 'archived'
          );

          return (
            <div key={q.id} className="bg-[#0f2442]/40 border border-cyan-900/30 rounded-xl p-6 flex flex-col h-[400px]">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-cyan-900/20">
                {getIcon(q)}
                <div>
                  <h3 className="font-bold text-slate-200">{q.label}</h3>
                  <p className="text-xs text-slate-500">{q.sub}</p>
                </div>
                <span className="ml-auto text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
                  {quadrantTasks.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {quadrantTasks.length > 0 ? (
                  quadrantTasks.map(task => (
                    <TaskCard key={task.id} task={task} compact />
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-sm italic">
                    No tasks in this quadrant
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