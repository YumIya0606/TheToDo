import { BookOpen, Plus, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { Button, Card } from '../ui/Button';
import { cn } from '@/lib/utils';

export function DiaryView() {
  const { openDiaryModal } = useUIStore();
  const { entries } = useDiaryStore();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Diary</h2>
          <p className="text-slate-400">Your private encrypted thoughts</p>
        </div>
        <Button onClick={() => openDiaryModal()} className="gap-2 bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BookOpen className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No entries yet</h3>
          <p className="text-slate-500 mb-4">Start writing your daily thoughts securely</p>
          <Button onClick={() => openDiaryModal()}>Create First Entry</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <Card 
              key={entry.id} 
              className="p-6 cursor-pointer hover:border-purple-500/50 transition-all group"
              onClick={() => openDiaryModal(entry.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    {entry.isLocked && <Lock className="h-3 w-3 text-slate-500" />}
                  </div>
                  <p className="text-slate-300 line-clamp-2">
                    {entry.isLocked ? '🔒 This entry is encrypted' : entry.content.slice(0, 150)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}