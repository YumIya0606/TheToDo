import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Save, Moon, Trash2, Type, Minimize2 } from 'lucide-react';
import { useDiaryStore } from '@/stores/diaryStore';
import type { DiaryEntry } from '@/stores/diaryStore';
import { cn } from '@/lib/utils';

const MOODS = [
  { label: 'Sad', color: 'text-blue-400/80 border-blue-500/30 bg-blue-500/10' },
  { label: 'Reflective', color: 'text-amber-300/80 border-amber-500/30 bg-amber-500/10' },
  { label: 'Silent', color: 'text-slate-400/80 border-slate-500/30 bg-slate-500/10' },
  { label: 'Deep', color: 'text-violet-400/80 border-violet-500/30 bg-violet-500/10' },
] as const;

type FontKey = 'serif' | 'mono' | 'sans';

export function SilentBoyView() {
  const { entries, addEntry, updateEntry, deleteEntry } = useDiaryStore();
  const pieces = entries.filter((e) => e.mood != null || e.fontStyle != null);

  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [writingMode, setWritingMode] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string>('Silent');
  const [font, setFont] = useState<FontKey>('serif');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWriting = writingMode;

  const startNew = () => {
    setEditing(null);
    setContent('');
    setMood('Silent');
    setFont('serif');
    setWritingMode(true);
  };

  const startEdit = (entry: DiaryEntry) => {
    setEditing(entry);
    setContent(entry.content);
    setMood(entry.mood ?? 'Silent');
    setFont((entry.fontStyle as FontKey) ?? 'serif');
    setWritingMode(true);
  };

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 1200);
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const data = {
      content,
      mood: mood as DiaryEntry['mood'],
      fontStyle: font,
      date: editing?.date || new Date().toISOString(),
    };
    if (editing?.id) {
      updateEntry(editing.id, data);
    } else {
      addEntry({ ...data, isLocked: false });
    }
    setWritingMode(false);
    setEditing(null);
  };

  const moodColor = (m: string | null | undefined) =>
    MOODS.find((x) => x.label === m)?.color || MOODS[2].color;

  const fontClass = font === 'mono' ? 'font-mono' : font === 'sans' ? 'font-sans' : 'font-serif';

  return (
    <div className="bg-black text-slate-200 min-h-full relative">
      {/* Ambient glow dot */}
      <div
        className={cn(
          'fixed top-6 right-6 h-2 w-2 rounded-full transition-all duration-700 pointer-events-none z-20',
          isTyping
            ? 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.8)]'
            : 'bg-slate-800'
        )}
      />

      <AnimatePresence mode="wait">
        {!isWriting ? (
          /* ── Library ── */
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-5xl mx-auto px-6 pt-24 pb-16"
          >
            <div className="flex items-center justify-between mb-14">
              <div>
                <h2 className="text-2xl font-light tracking-[0.2em] text-slate-200 flex items-center gap-3">
                  <Moon className="h-5 w-5 text-slate-700" /> SilentBoy
                </h2>
                <p className="text-[11px] text-slate-700 mt-1 tracking-[0.3em] uppercase">
                  deep writing · lyrics · poetry
                </p>
              </div>
              <button
                onClick={startNew}
                className="flex items-center gap-2 h-9 px-4 text-sm border border-slate-800 rounded-full text-slate-500 hover:text-slate-100 hover:border-slate-600 transition-all"
              >
                <Plus className="h-4 w-4" /> New Piece
              </button>
            </div>

            {pieces.length === 0 ? (
              <button
                onClick={startNew}
                className="w-full py-24 text-slate-700 hover:text-slate-400 transition-all text-sm tracking-[0.2em]"
              >
                the silence is waiting — write your first piece
              </button>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pieces.map((piece) => (
                  <div key={piece.id} className="group relative rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all">
                    <button
                      onClick={() => startEdit(piece)}
                      className="w-full text-left p-6 rounded-2xl"
                    >
                      <span
                        className={cn(
                          'inline-block mb-3 px-2 py-0.5 text-[10px] tracking-widest rounded-full border',
                          moodColor(piece.mood)
                        )}
                      >
                        {piece.mood || 'Silent'}
                      </span>
                      <p
                        className={cn(
                          'text-sm leading-relaxed text-slate-400 line-clamp-4 whitespace-pre-wrap',
                          piece.fontStyle === 'mono' ? 'font-mono' : piece.fontStyle === 'sans' ? 'font-sans' : 'font-serif'
                        )}
                      >
                        {piece.content}
                      </p>
                      <p className="mt-3 text-[10px] text-slate-700 tracking-wider">
                        {new Date(piece.date).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      onClick={() => deleteEntry(piece.id)}
                      className="absolute top-4 right-4 p-1.5 text-slate-800 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          /* ── Full-viewport Writing Mode ── */
          <motion.div
            key="writing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-30 bg-black flex flex-col"
          >
            {/* Single clean toolbar row — sits below the global hamburger (top-6),
                never overlaps it, and the Back button always stays visible. */}
            <div className="flex items-center gap-2 px-6 pt-20 pb-3 z-10">
              {/* Back — always accessible, never fades */}
              <button
                onClick={() => setWritingMode(false)}
                title="Back to Library"
                className="h-9 px-4 flex-shrink-0 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-600 rounded-full transition-all bg-black/60 backdrop-blur-md"
              >
                <Minimize2 className="h-3.5 w-3.5" /> Back
              </button>

              <motion.div
                animate={{ opacity: isTyping ? 0.15 : 1 }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
              >
                {MOODS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => setMood(m.label)}
                    className={cn(
                      'flex-shrink-0 px-2.5 py-1 text-[10px] tracking-widest rounded-full border transition-all',
                      mood === m.label ? m.color : 'border-slate-900 text-slate-700 hover:text-slate-500'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </motion.div>

              <motion.div
                animate={{ opacity: isTyping ? 0.15 : 1 }}
                transition={{ duration: 0.6 }}
                className="ml-auto flex items-center gap-2 flex-shrink-0"
              >
                <button
                  onClick={() => setFont((f) => (f === 'serif' ? 'mono' : f === 'mono' ? 'sans' : 'serif'))}
                  title="Toggle font (serif / mono / sans)"
                  className="h-9 px-3 text-xs text-slate-600 hover:text-slate-200 border border-slate-900 hover:border-slate-700 rounded-full transition-all flex items-center gap-2"
                >
                  <Type className="h-3.5 w-3.5" /> {font}
                </button>
                <button
                  onClick={handleSave}
                  className="h-9 px-4 text-sm bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-full transition-all flex items-center gap-2"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </motion.div>
            </div>

            <textarea
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              autoFocus
              placeholder="write the words you never said..."
              className={cn(
                'flex-1 min-h-0 w-full bg-black text-slate-300 text-xl leading-loose resize-none outline-none',
                'max-w-3xl mx-auto block px-8 text-center',
                'placeholder:text-slate-800 caret-cyan-400',
                fontClass
              )}
            />

            <div className={cn(
              'pb-6 pt-2 text-center text-[10px] tracking-widest tabular-nums transition-opacity duration-700',
              isTyping ? 'opacity-0' : 'opacity-100 text-slate-800'
            )}>
              {content.split(/\s+/).filter(Boolean).length} words · {content.split('\n').length} lines
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
