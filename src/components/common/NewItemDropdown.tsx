import { Plus, CheckSquare, FileText, BookOpen } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function NewItemDropdown() {
  const { openTaskModal, openNoteModal, openDiaryModal } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  let timeoutId: NodeJS.Timeout | null = null;

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutId = setTimeout(() => {
      setIsOpen(false);
    }, 200); // Small delay to allow moving cursor to menu
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20">
        <Plus className="h-4 w-4" />
        <span>New</span>
      </Button>

      {/* Dropdown Menu */}
      <div 
        className={cn(
          "absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 origin-bottom-left z-50",
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
      >
        <div className="p-1">
          <button
            onClick={() => { setIsOpen(false); openTaskModal(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group"
          >
            <div className="p-2 rounded-md bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
              <CheckSquare className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="font-medium">Task</div>
              <div className="text-[10px] text-slate-500">With due date & tags</div>
            </div>
          </button>

          <button
            onClick={() => { setIsOpen(false); openNoteModal(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group"
          >
            <div className="p-2 rounded-md bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
              <FileText className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-left">
              <div className="font-medium">Note</div>
              <div className="text-[10px] text-slate-500">Quick thoughts</div>
            </div>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            onClick={() => { setIsOpen(false); openDiaryModal(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group"
          >
            <div className="p-2 rounded-md bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <BookOpen className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-left">
              <div className="font-medium">Diary</div>
              <div className="text-[10px] text-slate-500">Encrypted journal</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}