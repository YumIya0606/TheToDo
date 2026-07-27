import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, Search, Plus, FileText, CheckSquare, Settings, Moon } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { Button, Input } from './ui/Button';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { setView, toggleFocusMode, setSelectedTaskId, setSelectedNoteId } = useUIStore();
  const { tasks, addTask, searchTasks } = useTaskStore();
  const { notes, addNote, searchNotes } = useNoteStore();

  const filteredTasks = query ? searchTasks(query) : tasks.slice(0, 5);
  const filteredNotes = query ? searchNotes(query) : notes.slice(0, 5);

  const handleNewTask = () => {
    addTask({
      title: query || 'New Task',
      description: '',
      priority: 'medium',
      status: 'todo',
      category: 'General',
      tags: [],
    });
    onClose();
  };

  const handleNewNote = () => {
    addNote({
      title: query || 'New Note',
      content: '',
      folder: 'Uncategorized',
      tags: [],
    });
    onClose();
  };

  const actions = [
    {
      id: 'view-list',
      label: 'Switch to List View',
      icon: <CheckSquare className="h-4 w-4" />,
      action: () => { setView('list'); onClose(); },
    },
    {
      id: 'view-kanban',
      label: 'Switch to Kanban View',
      icon: <Command className="h-4 w-4" />,
      action: () => { setView('kanban'); onClose(); },
    },
    {
      id: 'view-matrix',
      label: 'Switch to Matrix View',
      icon: <Command className="h-4 w-4" />,
      action: () => { setView('matrix'); onClose(); },
    },
    {
      id: 'focus-mode',
      label: 'Toggle Focus Mode',
      icon: <Moon className="h-4 w-4" />,
      action: () => { toggleFocusMode(); onClose(); },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="rounded-lg border border-white/20 bg-card shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 p-4 border-b border-white/10">
                <Search className="h-5 w-5 text-gray-400" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="border-0 bg-transparent px-0 text-base focus-visible:ring-0"
                />
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {/* Quick Actions */}
                {!query && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                      Quick Actions
                    </div>
                    {actions.map((action) => (
                      <button
                        key={action.id}
                        onClick={action.action}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 transition-colors text-left"
                      >
                        {action.icon}
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Create Commands */}
                {query && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                      Create
                    </div>
                    <button
                      onClick={handleNewTask}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 transition-colors text-left"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create task "{query}"</span>
                    </button>
                    <button
                      onClick={handleNewNote}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 transition-colors text-left"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Create note "{query}"</span>
                    </button>
                  </div>
                )}

                {/* Tasks */}
                {filteredTasks.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                      Tasks
                    </div>
                    {filteredTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => { setSelectedTaskId(task.id); onClose(); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 transition-colors text-left"
                      >
                        <CheckSquare className="h-4 w-4" />
                        <span className="truncate">{task.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {filteredNotes.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                      Notes
                    </div>
                    {filteredNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => { setSelectedNoteId(note.id); onClose(); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-white/10 transition-colors text-left"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="truncate">{note.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {query && filteredTasks.length === 0 && filteredNotes.length === 0 && (
                  <div className="text-sm text-gray-500 py-8 text-center">
                    No results found
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
