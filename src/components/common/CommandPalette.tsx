import { useState, useEffect, useCallback } from 'react';
import { Search, X, Plus, FileText, CalendarClock, Target } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDismissOnOutside } from '@/lib/useDismiss';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const { openTaskModal, openNoteModal, openDiaryModal, setView } = useUIStore();

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

  const close = useCallback(() => setIsOpen(false), []);
  // Clicking anywhere outside the palette closes it, and so does Escape. Without
  // this it sat open under the cursor with nothing to dismiss it.
  const ref = useDismissOnOutside<HTMLDivElement>(isOpen, close);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[20vh] p-4"
      onClick={close}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center border-b border-slate-800 px-4">
          <Search className="h-5 w-5 text-slate-400 mr-3" />
          <input
            autoFocus
            placeholder="Type a command or search..."
            className="w-full bg-transparent py-4 text-sm text-slate-100 focus:outline-none"
          />
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-2">
          <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-slate-600">Create</p>
          <button onClick={() => { openTaskModal(); setIsOpen(false); }} className="btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            <Plus className="icon-pop h-4 w-4 text-emerald-400" /> Create Task
          </button>
          <button onClick={() => { openNoteModal(); setIsOpen(false); }} className="btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            <FileText className="icon-pop h-4 w-4 text-indigo-400" /> Create Note
          </button>
          <button onClick={() => { openDiaryModal(); setIsOpen(false); }} className="btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            <FileText className="icon-pop h-4 w-4 text-purple-400" /> Write Diary
          </button>
          <p className="px-3 py-1 pt-3 text-[10px] uppercase tracking-widest text-slate-600">Navigate</p>
          <button onClick={() => { setView('planner'); setIsOpen(false); }} className="btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            <CalendarClock className="icon-pop h-4 w-4 text-cyan-400" /> Study Planner
          </button>
          <button onClick={() => { setView('dashboard'); setIsOpen(false); }} className="btn-press w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-sm">
            <Target className="icon-pop h-4 w-4 text-amber-400" /> Tasks Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}