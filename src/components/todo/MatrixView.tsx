import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { Priority } from '@/types';

const quadrants: { id: string; label: string; sub: string; priorities: Priority[]; urgent: boolean }[] = [
  { id: 'q1', label: 'Do First', sub: 'Urgent & Important', priorities: ['urgent', 'high'], urgent: true },
  { id: 'q2', label: 'Schedule', sub: 'Not Urgent & Important', priorities: ['medium', 'high'], urgent: false },
  { id: 'q3', label: 'Delegate', sub: 'Urgent & Not Important', priorities: ['urgent', 'low'], urgent: true },
  { id: 'q4', label: 'Eliminate', sub: 'Not Urgent & Not Important', priorities: ['low', 'medium'], urgent: false },
];
// Simplified logic for demo: Real Eisenhower matrix requires specific logic mapping. 
// Here we just group by priority for visual demonstration of the grid.

export function MatrixView() {
  const { tasks } = useTaskStore();
  
  // Simple grouping for the 4 quadrants based on priority for this demo
  const getQuadrantTasks = (type: number) => {
    if (type === 0) return tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');
    if (type === 1) return tasks.filter(t => (t.priority === 'medium' || t.priority === 'high') && t.status === 'todo');
    if (type === 2) return tasks.filter(t => (t.priority === 'urgent' || t.priority === 'low') && t.status === 'in_progress');
    return tasks.filter(t => t.priority === 'low' && t.status !== 'completed');
  };

  const layout = [
    { title: 'Urgent & Important', desc: 'Do these now', tasks: getQuadrantTasks(0), color: 'border-red-500/30 bg-red-500/5' },
    { title: 'Not Urgent & Important', desc: 'Schedule these', tasks: getQuadrantTasks(1), color: 'border-blue-500/30 bg-blue-500/5' },
    { title: 'Urgent & Not Important', desc: 'Delegate if possible', tasks: getQuadrantTasks(2), color: 'border-orange-500/30 bg-orange-500/5' },
    { title: 'Not Urgent & Not Important', desc: 'Eliminate', tasks: getQuadrantTasks(3), color: 'border-slate-500/30 bg-slate-500/5' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full animate-in fade-in duration-500">
      {layout.map((q, i) => (
        <div key={i} className={`p-6 rounded-2xl border ${q.color} flex flex-col h-[400px]`}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">{q.title}</h3>
            <p className="text-sm text-slate-400">{q.desc}</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {q.tasks.map(task => <TaskCard key={task.id} task={task} compact />)}
            {q.tasks.length === 0 && <div className="text-sm text-slate-500 italic">No tasks in this quadrant</div>}
          </div>
        </div>
      ))}
    </div>
  );
}