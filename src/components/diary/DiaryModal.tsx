import { useState, useEffect } from 'react';
import { Lock, Unlock, Save } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { UnifiedModal } from '../common/UnifiedModal';
import { cn } from '@/lib/utils';

export function DiaryModal() {
  const { isDiaryModalOpen, closeDiaryModal, editingDiaryId } = useUIStore();
  const { addEntry, updateEntry, getEntryById } = useDiaryStore();
  
  const [content, setContent] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const editingEntry = editingDiaryId ? getEntryById(editingDiaryId) : null;

  useEffect(() => {
    if (editingEntry) {
      setIsLocked(editingEntry.isLocked);
      if (editingEntry.isLocked) {
        setShowPasswordInput(true);
        setContent('');
      } else {
        setContent(editingEntry.content);
        setShowPasswordInput(false);
      }
    } else {
      setContent(''); setIsLocked(false); setPassword(''); setUnlockPassword(''); setShowPasswordInput(false);
    }
  }, [editingEntry, isDiaryModalOpen]);

  const handleUnlock = () => {
    if (editingEntry && editingEntry.passwordHash === unlockPassword) {
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

  if (showPasswordInput) {
    return (
      <UnifiedModal isOpen={isDiaryModalOpen} onClose={closeDiaryModal} title="Locked Entry">
        <div className="space-y-4">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-sm text-purple-300 mb-2">This entry is encrypted</p>
            <input
              type="password"
              value={unlockPassword}
              onChange={e => setUnlockPassword(e.target.value)}
              className="w-full rounded-lg border border-purple-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none mb-3"
              placeholder="Enter password to unlock"
              autoFocus
            />
            <button type="button" onClick={handleUnlock} className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors">
              <Unlock className="h-4 w-4 inline mr-2" /> Unlock
            </button>
          </div>
        </div>
      </UnifiedModal>
    );
  }

  return (
    <UnifiedModal
      isOpen={isDiaryModalOpen}
      onClose={closeDiaryModal}
      title={editingEntry ? 'Edit Diary Entry' : 'New Diary Entry'}
      onSubmit={handleSubmit}
      submitLabel={<><Save className="h-4 w-4 inline mr-2" />{editingEntry ? 'Save Changes' : 'Save Entry'}</>}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-[#060f1c] rounded-lg border border-cyan-900/30">
          <span className="text-sm text-slate-300">Encrypt this entry</span>
          <button
            type="button"
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              "p-2 rounded-md transition-all",
              isLocked ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            )}
          >
            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
        </div>

        {isLocked && !editingEntry && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Set Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
              placeholder="Create a password for this entry"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">What happened today?</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-4 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none min-h-[300px] leading-relaxed font-serif"
            placeholder="Dear diary..."
            autoFocus={!editingEntry}
          />
        </div>
      </div>
    </UnifiedModal>
  );
}