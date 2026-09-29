import { Hash, TrendingUp } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '../ui/Button';
import { useState, useMemo } from 'react';

// Define color mapping for tags based on content or name
const TAG_COLORS = [
  'from-cyan-500 to-blue-600',
  'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-indigo-500 to-violet-600',
];

export function TagsView() {
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Collect all tags from tasks and notes
  const allTags = useMemo(() => {
    const tagMap = new Map<string, { count: number; color: string }>();

    // Process task tags
    tasks.forEach(task => {
      task.tags.forEach(tag => {
        const cleanTag = tag.replace('#', '').toLowerCase();
        if (!tagMap.has(cleanTag)) {
          const colorIndex = cleanTag.length % TAG_COLORS.length;
          tagMap.set(cleanTag, { count: 0, color: TAG_COLORS[colorIndex] });
        }
        const existing = tagMap.get(cleanTag)!;
        existing.count += 1;
      });
    });

    // Process note tags
    notes.forEach(note => {
      note.tags.forEach(tag => {
        const cleanTag = tag.replace('#', '').toLowerCase();
        if (!tagMap.has(cleanTag)) {
          const colorIndex = cleanTag.length % TAG_COLORS.length;
          tagMap.set(cleanTag, { count: 0, color: TAG_COLORS[colorIndex] });
        }
        const existing = tagMap.get(cleanTag)!;
        existing.count += 1;
      });
    });

    return Array.from(tagMap.entries()).map(([name, data]) => ({
      name: `#${name}`,
      count: data.count,
      color: data.color,
    })).sort((a, b) => b.count - a.count);
  }, [tasks, notes]);

  const filteredTags = allTags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Tags" 
        subtitle="Manage your subject and task categories" 
      />

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-cyan-900/30 bg-[#0f2442]/50 px-4 py-3 pl-11 text-sm text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
        />
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
      </div>

      {/* Tags Grid */}
      {filteredTags.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800/50 mb-4">
            <Hash className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No tags found</h3>
          <p className="text-slate-500">Add tags to your tasks or notes to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTags.map((tag) => (
            <Card key={tag.name} className="group relative overflow-hidden p-6 hover:shadow-lg transition-all duration-300 border border-cyan-900/20 bg-[#0f2442]/40">
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${tag.color} opacity-10 rounded-bl-full transition-opacity group-hover:opacity-20`} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${tag.color} bg-opacity-10`}>
                    <Hash className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                    {tag.count} {tag.count === 1 ? 'item' : 'items'}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{tag.name}</h3>
                <p className="text-sm text-slate-400">Used across tasks and notes</p>
                
                <div className="mt-4 pt-4 border-t border-cyan-900/20 flex items-center justify-between">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Active
                  </span>
                  <button className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
                    View Items &rarr;
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}