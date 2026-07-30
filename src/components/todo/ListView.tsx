import { useState } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { TaskCard } from './TaskCard';
import { Input, Button } from '../ui/Button';
import { Search, Filter } from 'lucide-react';

export function ListView() {
  const { tasks } = useTaskStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filtered = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ? true : filter === 'completed' ? t.status === 'completed' : t.status !== 'completed';
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">All Tasks</h2>
          <p className="text-slate-400">Manage and track your daily activities.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 w-64" />
          </div>
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(task => <TaskCard key={task.id} task={task} />)}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">No tasks found matching your criteria.</div>
        )}
      </div>
    </div>
  );
}