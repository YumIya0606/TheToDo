import { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, FolderOpen } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useNoteStore } from '@/stores/noteStore';
import { UnifiedModal } from '../common/UnifiedModal';

export function NoteModal() {
  const { isNoteModalOpen, closeNoteModal, editingNoteId } = useUIStore();
  const { addNote, updateNote, getNoteById } = useNoteStore();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folder, setFolder] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const editingNote = editingNoteId ? getNoteById(editingNoteId) : null;

  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title);
      setContent(editingNote.content);
      setFolder(editingNote.folder);
      setTagList(editingNote.tags);
    } else {
      setTitle(''); setContent(''); setFolder(''); setTagList([]); setNewTag('');
    }
  }, [editingNote, isNoteModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const noteData = { title, content, folder: folder || 'Uncategorized', tags: tagList };

    if (editingNote) {
      updateNote(editingNote.id, { ...noteData, updatedAt: new Date().toISOString() });
    } else {
      // Fixed: Removed updatedAt and createdAt from payload (handled by store)
      addNote(noteData);
    }
    closeNoteModal();
  };

  const handleAddTag = () => {
    if (!newTag.trim() || tagList.includes(newTag.trim())) return;
    setTagList([...tagList, newTag.trim()]);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagList(tagList.filter(t => t !== tagToRemove));
  };

  return (
    <UnifiedModal
      isOpen={isNoteModalOpen}
      onClose={closeNoteModal}
      title={editingNote ? 'Edit Note' : 'Create New Note'}
      onSubmit={handleSubmit}
      submitLabel={editingNote ? 'Save Changes' : 'Create Note'}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder-slate-600"
            placeholder="Enter note title..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-4 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder-slate-600 min-h-[300px] font-mono leading-relaxed"
            placeholder="Write your note content here... (Markdown supported)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Folder</label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={folder}
              onChange={e => setFolder(e.target.value)}
              className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 pl-10 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none transition-all placeholder-slate-600"
              placeholder="e.g., Personal, Work, Scripts"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Tags</label>
          <div className="flex gap-2 mb-3">
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              placeholder="Add a tag..."
              className="flex-1 rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            />
            <button type="button" onClick={handleAddTag} className="p-2.5 rounded-lg bg-cyan-900/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagList.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <TagIcon className="h-3 w-3" />
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </UnifiedModal>
  );
}