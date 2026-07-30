import { useEffect, useState } from 'react';
import { Command, Search, X, Plus, FileText, CheckSquare } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Input } from '../ui/Button';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const { isTaskModalOpen, openTaskModal, closeTaskModal } = useUIStore(); // Simplified for demo
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4" onClick={() => setIsOpen(false)}>
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-slate-800 p-4">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <Input
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus:ring-0 bg-transparent p-0 text-base"
          />
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Actions</div>
          <button onClick={() => { setIsOpen(false); openTaskModal(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors">
            <Plus className="h-4 w-4 text-emerald-500" /> Create New Task
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors">
            <FileText className="h-4 w-4 text-blue-500" /> Create Note (Coming Soon)
          </button>
        </div>
        <div className="bg-slate-950/50 p-2 text-xs text-slate-500 text-center border-t border-slate-800">
          Press <kbd className="font-mono bg-slate-800 px-1 rounded">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}