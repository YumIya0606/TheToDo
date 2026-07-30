import { X, CheckSquare, FileText } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button, Card } from '../ui/Button';
import { cn } from '@/lib/utils';

export function NewItemModal() {
  const { isNewItemModalOpen, closeNewItemModal, openTaskModal, openNoteModal } = useUIStore();

  if (!isNewItemModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Create New</h2>
          <button type="button" onClick={closeNewItemModal} className="text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <Card 
            className={cn(
              "p-6 cursor-pointer transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/5 group",
              "border border-slate-700 bg-slate-800/50"
            )}
          >
            <div 
              className="flex items-center gap-4"
              onClick={() => {
                closeNewItemModal();
                openTaskModal();
              }}
            >
              <div className="p-3 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <CheckSquare className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Task</h3>
                <p className="text-sm text-slate-400">Create a new task with due date, priority, and tags</p>
              </div>
            </div>
          </Card>

          <Card 
            className={cn(
              "p-6 cursor-pointer transition-all duration-200 hover:border-indigo-500/50 hover:bg-indigo-500/5 group",
              "border border-slate-700 bg-slate-800/50"
            )}
          >
            <div 
              className="flex items-center gap-4"
              onClick={() => {
                closeNewItemModal();
                openNoteModal();
              }}
            >
              <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                <FileText className="h-8 w-8 text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Note</h3>
                <p className="text-sm text-slate-400">Create a new note with title, content, and tags</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-800">
          <Button variant="ghost" onClick={closeNewItemModal}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}