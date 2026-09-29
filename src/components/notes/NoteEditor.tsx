import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { Note } from '@/types';
import { useNoteStore } from '@/stores/noteStore';
import { cn } from '@/lib/utils';

interface NoteEditorProps {
  note: Note;
  onSave?: (content: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onSave }) => {
  const { updateNote } = useNoteStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'p-4 rounded-md bg-gray-900 text-gray-100 font-mono text-sm',
          },
        },
        code: {
          HTMLAttributes: {
            class: 'px-1.5 py-0.5 rounded bg-gray-800 text-pink-400 font-mono text-sm',
          },
        },
      }),
    ],
    content: note.content,
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      onSave?.(content);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== note.content) {
      editor.commands.setContent(note.content);
    }
  }, [note.id]);

  const handleSave = () => {
    if (editor) {
      const content = editor.getHTML();
      updateNote(note.id, { content, updatedAt: new Date().toISOString() });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h2 className="font-semibold text-lg">{note.title}</h2>
        <button
          onClick={handleSave}
          className="text-xs px-3 py-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          Save
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Markdown/LaTeX hints */}
      <div className="p-2 border-t border-white/10 text-xs text-gray-500">
        <span className="mr-4"># Heading</span>
        <span className="mr-4">**bold**</span>
        <span className="mr-4">*italic*</span>
        <span className="mr-4">`code`</span>
        <span>$LaTeX$</span>
      </div>
    </div>
  );
};

interface NotePreviewProps {
  content: string;
}

export const NotePreview: React.FC<NotePreviewProps> = ({ content }) => {
  return (
    <div
      className={cn(
        'prose prose-invert prose-sm max-w-none p-4',
        'prose-headings:text-foreground',
        'prose-a:text-primary',
        'prose-code:text-pink-400 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded',
        'prose-pre:bg-gray-900 prose-pre:border prose-pre:border-white/10'
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
