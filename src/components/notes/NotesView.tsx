import { useState } from 'react';
import { FileText, Plus, Search } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useNoteStore } from '@/stores/noteStore';
import { Card } from '../ui/Button';
import { PageHeader } from '../common/PageHeader';

export function NotesView() {
  const { openNoteModal } = useUIStore();
  const { notes } = useNoteStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Notes" 
        subtitle="Organize your thoughts, code snippets, and study materials" 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] pl-10 pr-4 py-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
          />
        </div>
        <button
          onClick={() => openNoteModal()}
          className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Note
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map(note => (
          <div key={note.id} onClick={() => openNoteModal(note.id)} className="cursor-pointer">
            <Card className="p-6 h-full hover:border-cyan-500/50 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <FileText className="h-5 w-5 text-cyan-500 group-hover:text-cyan-400 transition-colors" />
                <span className="text-xs text-slate-500">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                {note.title}
              </h3>
              <p className="text-sm text-slate-400 line-clamp-3 mb-4">
                {note.content}
              </p>
              <div className="flex flex-wrap gap-2">
                {note.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    #{tag}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}