import { useState } from 'react';
import { FileText, Plus, Search, FolderOpen } from 'lucide-react';
import { useNoteStore } from '@/stores/noteStore';
import { useUIStore } from '@/stores/uiStore';
import { Button, Input, Card } from '../ui/Button';
import { cn } from '@/lib/utils';

export function NotesView() {
  const { notes, deleteNote, searchNotes } = useNoteStore();
  const { openNoteModal } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Get all unique folders
  const folders = Array.from(new Set(notes.map(n => n.folder))).filter(Boolean);
  
  // Filter notes
  const filteredNotes = searchQuery 
    ? searchNotes(searchQuery)
    : selectedFolder
      ? notes.filter(n => n.folder === selectedFolder)
      : notes;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Notes</h2>
          <p className="text-slate-400">Organize your thoughts and ideas</p>
        </div>
        <Button onClick={() => openNoteModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          New Note
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search notes..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-10" 
          />
        </div>
        {folders.length > 0 && (
          <select 
            value={selectedFolder || ''} 
            onChange={e => setSelectedFolder(e.target.value || null)}
            className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Folders</option>
            {folders.map(folder => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        )}
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => (
            <Card 
              key={note.id} 
              className={cn(
                "p-5 cursor-pointer transition-all duration-200 group",
                "hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-900/10"
              )}
              onClick={() => openNoteModal(note.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  <h3 className="font-semibold text-white truncate flex-1">{note.title}</h3>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <FileText className="h-4 w-4 text-red-400 rotate-45" />
                </button>
              </div>
              <p className="text-sm text-slate-400 line-clamp-3 mb-4">
                {note.content.replace(/<[^>]*>/g, '').slice(0, 150)}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {note.tags.slice(0, 3).map(tag => (
                    <span 
                      key={tag} 
                      className="text-[10px] uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                  {note.tags.length > 3 && (
                    <span className="text-[10px] text-slate-500">+{note.tags.length - 3}</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/10 rounded-lg p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </h3>
          <p className="text-slate-500 mb-4">
            {searchQuery 
              ? 'Try a different search term' 
              : 'Create your first note to start organizing your thoughts'}
          </p>
          {!searchQuery && (
            <Button onClick={() => openNoteModal()} variant="outline">
              Create Note
            </Button>
          )}
        </div>
      )}
    </div>
  );
}