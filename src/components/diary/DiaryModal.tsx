import { useState, useEffect, useRef } from 'react';
import { X, Lock, Unlock, Save } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { Button, Input } from '../ui/Button';
import { cn } from '@/lib/utils';

export function DiaryModal() {
  const { isDiaryModalOpen, closeDiaryModal, editingDiaryId } = useUIStore();
  const { addEntry, updateEntry, getEntryById } = useDiaryStore();
  
  const [content, setContent] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const editingEntry = editingDiaryId ? getEntryById(editingDiaryId) : null;

  useEffect(() => {
    if (editingEntry) {
      setIsLocked(editingEntry.isLocked);
      if (editingEntry.isLocked) {
        setIsUnlocked(false);
        setShowPasswordInput(true);
      } else {
        setContent(editingEntry.content);
        setIsUnlocked(true);
        setShowPasswordInput(false);
      }
    } else {
      resetForm();
    }
  }, [editingEntry, isDiaryModalOpen]);

  const resetForm = () => {
    setContent('');
    setIsLocked(false);
    setPassword('');
    setUnlockPassword('');
    setIsUnlocked(false);
    setShowPasswordInput(false);
  };

  const handleUnlock = () => {
    if (editingEntry && editingEntry.passwordHash === unlockPassword) { // Simple hash check for demo
      setIsUnlocked(true);
      setContent(editingEntry.content);
      setShowPasswordInput(false);
    } else {
      alert('Incorrect password');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !editingEntry) return;

    const entryData = {
      content,
      isLocked,
      passwordHash: isLocked ? (password || editingEntry?.passwordHash) : undefined,
      date: editingEntry?.date || new Date().toISOString(),
    };

    if (editingEntry) {
      updateEntry(editingEntry.id, entryData);
    } else {
      addEntry(entryData);
    }
    closeDiaryModal();
  };

  if (!isDiaryModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {editingEntry ? 'Edit Diary Entry' : 'New Diary Entry'}
              {isLocked && <Lock className="h-4 w-4 text-purple-400" />}
            </h2>
            <button type="button" onClick={closeDiaryModal} className="text-slate-400 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>

          {showPasswordInput ? (
            <div className="space-y-4">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-sm text-purple-300 mb-2">This entry is encrypted</p>
                <Input 
                  type="password" 
                  value={unlockPassword} 
                  onChange={e => setUnlockPassword(e.target.value)} 
                  placeholder="Enter password to unlock" 
                  autoFocus
                />
                <Button type="button" onClick={handleUnlock} className="w-full mt-2 bg-purple-600">
                  <Unlock className="h-4 w-4 mr-2" /> Unlock
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                <span className="text-sm text-slate-300">Encrypt this entry</span>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    isLocked ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-400"
                  )}
                >
                  {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </button>
              </div>

              {isLocked && !editingEntry && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Set Password</label>
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Create a password for this entry" 
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">What happened today?</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 min-h-[300px] leading-relaxed"
                  placeholder="Dear diary..."
                  autoFocus={!editingEntry}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <Button type="button" variant="ghost" onClick={closeDiaryModal}>Cancel</Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Save className="h-4 w-4 mr-2" />
                  {editingEntry ? 'Save Changes' : 'Save Entry'}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}