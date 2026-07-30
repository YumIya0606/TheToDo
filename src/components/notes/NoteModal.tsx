import { useState, useEffect, useRef } from 'react';
import { X, Tag as TagIcon, Plus, FolderOpen } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useNoteStore } from '@/stores/noteStore';
import { Button, Input } from '../ui/Button';
import { cn } from '@/lib/utils';

interface NoteModalProps {
  onClose?: () => void;
}

export function NoteModal({ onClose }: NoteModalProps) {
  const { isNoteModalOpen, closeNoteModal, editingNoteId } = useUIStore();
  const { notes, addNote, updateNote, getNoteById } = useNoteStore();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folder, setFolder] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const editingNote = editingNoteId ? getNoteById(editingNoteId) : null;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeNoteModal();
        onClose?.();
      }
    };

    if (isNoteModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNoteModalOpen, closeNoteModal, onClose]);

  useEffect(() => {
    if (editingNote) {
      setTitle(editingNote.title);
      setContent(editingNote.content);
      setFolder(editingNote.folder);
      setTagList(editingNote.tags);
    } else {
      resetForm();
    }
  }, [editingNote, isNoteModalOpen]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setFolder('');
    setTagList([]);
    setNewTag('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const noteData = {
      title,
      content,
      folder: folder || 'Uncategorized',
      tags: tagList,
    };

    if (editingNote) {
      updateNote(editingNote.id, { ...noteData, updatedAt: new Date().toISOString() });
    } else {
      addNote({
        ...noteData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    closeNoteModal();
    onClose?.();
  };

  const handleAddTag = () => {
    if (!newTag.trim() || tagList.includes(newTag.trim())) return;
    setTagList([...tagList, newTag.trim()]);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagList(tagList.filter(t => t !== tagToRemove));
  };

  if (!isNoteModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center justify-between sticky top-0 bg-slate-900 pb-4 border-b border-slate-800 z-10">
            <h2 className="text-xl font-bold text-white">{editingNote ? 'Edit Note' : 'Create New Note'}</h2>
            <button type="button" onClick={() => { closeNoteModal(); onClose?.(); }} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Enter note title..." 
                required 
                autoFocus 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Content</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[300px] font-mono leading-relaxed"
                placeholder="Write your note content here... (Markdown supported)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Folder</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input 
                  value={folder} 
                  onChange={e => setFolder(e.target.value)} 
                  placeholder="e.g., Personal, Work, Ideas" 
                  className="pl-10 bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Tags</label>
              <div className="flex gap-2 mb-3">
                <Input 
                  value={newTag} 
                  onChange={e => setNewTag(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} 
                  placeholder="Add a tag..." 
                  className="flex-1 bg-slate-950"
                />
                <Button type="button" onClick={handleAddTag} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {tagList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tagList.map(tag => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    >
                      <TagIcon className="h-3 w-3" />
                      {tag}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
            <Button type="button" variant="ghost" onClick={() => { closeNoteModal(); onClose?.(); }}>Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}