import { useState } from 'react';
import { Tag, Search, FileText, CheckSquare } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { TaskCard } from '../todo/TaskCard';
import { Input, Card } from '../ui/Button';
import { cn } from '@/lib/utils';

export function TagsView() {
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all unique tags from tasks and notes
  const allTags = Array.from(
    new Set([
      ...tasks.flatMap(t => t.tags),
      ...notes.flatMap(n => n.tags),
    ])
  ).sort();

  // Filter items by selected tag
  const filteredTasks = selectedTag
    ? tasks.filter(t => t.tags.includes(selectedTag))
    : tasks;

  const filteredNotes = selectedTag
    ? notes.filter(n => n.tags.includes(selectedTag))
    : notes;

  // Apply search filter
  const searchFilteredTasks = filteredTasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchFilteredNotes = filteredNotes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Tags</h2>
          <p className="text-slate-400">Browse tasks and notes by tags</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-10 w-64" 
          />
        </div>
      </div>

      {/* Tag Cloud */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Tag className="h-5 w-5 text-indigo-400" />
          All Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag(null)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              selectedTag === null
                ? "bg-emerald-500 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            )}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                selectedTag === tag
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      </Card>

      {/* Results */}
      <div className="grid gap-8">
        {/* Tasks Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-emerald-400" />
              Tasks {selectedTag && `#${selectedTag}`}
            </h3>
            <span className="text-sm text-slate-500">{searchFilteredTasks.length} items</span>
          </div>
          <div className="grid gap-3">
            {searchFilteredTasks.length > 0 ? (
              searchFilteredTasks.map(task => <TaskCard key={task.id} task={task} />)
            ) : (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No tasks found
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" />
              Notes {selectedTag && `#${selectedTag}`}
            </h3>
            <span className="text-sm text-slate-500">{searchFilteredNotes.length} items</span>
          </div>
          <div className="grid gap-3">
            {searchFilteredNotes.length > 0 ? (
              searchFilteredNotes.map(note => (
                <Card key={note.id} className="p-4 hover:border-indigo-500/30 transition-colors">
                  <h4 className="font-semibold text-white mb-2">{note.title}</h4>
                  <p className="text-sm text-slate-400 line-clamp-3">
                    {note.content.replace(/<[^>]*>/g, '').slice(0, 200)}
                  </p>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {note.tags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag)}
                          className="text-[10px] uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md hover:bg-indigo-500/20 transition-colors"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No notes found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}