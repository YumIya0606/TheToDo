import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Folder, FileText, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import type { Note } from '@/types';
import { useNoteStore } from '@/stores/noteStore';
import { cn } from '@/lib/utils';

interface NoteTreeProps {
  selectedNoteId: string | null;
  onSelectNote: (note: Note) => void;
  onNewNote: () => void;
}

export const NoteTree: React.FC<NoteTreeProps> = ({ selectedNoteId, onSelectNote, onNewNote }) => {
  const { notes, deleteNote } = useNoteStore();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));

  // Group notes by folder
  const folders = Array.from(new Set(notes.map((n) => n.folder)));

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const getNotesInFolder = (folder: string) => {
    return notes.filter((n) => n.folder === folder);
  };

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</h3>
        <button
          onClick={onNewNote}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          title="New Note"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Root / All Notes */}
      <div className="space-y-1">
        {folders.length === 0 ? (
          <div className="text-xs text-gray-500 py-4 px-2">No notes yet</div>
        ) : (
          folders.map((folder) => {
            const isExpanded = expandedFolders.has(folder);
            const folderNotes = getNotesInFolder(folder);

            return (
              <div key={folder}>
                <button
                  onClick={() => toggleFolder(folder)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  )}
                  <Folder className="h-4 w-4 text-yellow-500/80" />
                  <span className="text-sm">{folder || 'Uncategorized'}</span>
                  <span className="text-xs text-gray-500 ml-auto">{folderNotes.length}</span>
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="ml-4 mt-1 space-y-0.5"
                  >
                    {folderNotes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          'group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
                          selectedNoteId === note.id
                            ? 'bg-primary/20 text-primary'
                            : 'hover:bg-white/10'
                        )}
                        onClick={() => onSelectNote(note)}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="text-sm truncate flex-1">{note.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-all"
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
