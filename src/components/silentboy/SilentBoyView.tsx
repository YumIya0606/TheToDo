import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Lock,
  Moon,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react';
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

const FONT_CLASS: Record<FontKey, string> = {
  serif: 'font-serif',
  mono: 'font-mono',
  sans: 'font-sans',
};

function countWords(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function readingTime(minutes: number): string {
  return minutes < 1 ? '< 1 min' : `${minutes} min`;
}

export function SilentBoyView({ onExit }: { onExit?: () => void }) {
  const entries = useDiaryStore((s) => s.entries);
  const addEntry = useDiaryStore((s) => s.addEntry);
  const updateEntry = useDiaryStore((s) => s.updateEntry);
  const deleteEntry = useDiaryStore((s) => s.deleteEntry);

  // Only the pieces written here: anything with a mood or a chosen font.
  const pieces = useMemo(
    () => entries.filter((e) => e.mood != null || e.fontStyle != null),
    [entries]
  );

  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [reading, setReading] = useState<DiaryEntry | null>(null);
  const [writingMode, setWritingMode] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string>('Silent');
  const [font, setFont] = useState<FontKey>('serif');
  const [isTyping, setIsTyping] = useState(false);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitRef = useRef<(() => void) | null>(null);
  exitRef.current = onExit ?? null;

  const isWriting = writingMode;

  const startNew = useCallback(() => {
    setReading(null);
    setEditing(null);
    setContent('');
    setMood('Silent');
    setFont('serif');
    setWritingMode(true);
  }, []);

  const startEdit = useCallback((entry: DiaryEntry) => {
    setReading(null);
    setEditing(entry);
    setContent(entry.content);
    setMood(entry.mood ?? 'Silent');
    setFont((entry.fontStyle as FontKey) ?? 'serif');
    setWritingMode(true);
  }, []);

  const leaveWriting = useCallback(() => {
    setWritingMode(false);
    setEditing(null);
    setContent('');
  }, []);

  const handleSave = useCallback(() => {
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
    leaveWriting();
  }, [addEntry, content, editing, font, leaveWriting, mood, updateEntry]);

  /**
   * Escape leaves whatever is open, in one step, and the second press leaves
   * SilentBoy entirely. Before this the only way out of the writing screen was
   * the Back button, and the only way out of SilentBoy was the global menu, which
   * is several clicks away once the toolbar dims while you type.
   */
  useEffect(() => {
    if (!isWriting && !reading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isWriting) {
          if (content.trim() && !editing) {
            // Never throw away unsaved words without saying so.
            if (window.confirm('Discard this piece? It has not been saved.')) {
              leaveWriting();
            }
          } else {
            leaveWriting();
          }
        } else {
          setReading(null);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [content, editing, handleSave, isWriting, leaveWriting, reading]);

  // Library shortcuts, only when nothing is open on top.
  useEffect(() => {
    if (isWriting || reading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitRef.current?.();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startNew();
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('silentboy-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isWriting, reading, startNew]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    []
  );

  const handleChange = (value: string) => {
    setContent(value);
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 1200);
  };

  const moodColor = (m: string | null | undefined) =>
    MOODS.find((x) => x.label === m)?.color ?? MOODS[2].color;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? pieces.filter(
          (p) =>
            p.content.toLowerCase().includes(q) || (p.mood ?? '').toLowerCase().includes(q)
        )
      : pieces;
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pieces, query]);

  const totalWords = useMemo(
    () => pieces.reduce((n, p) => n + countWords(p.content), 0),
    [pieces]
  );

  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date());

  return (
    <div className="bg-[#05060a] text-slate-200 min-h-full relative overflow-hidden">
      {/* Ambient wash, so the black is not flat. Fixed and non-interactive so
          it never costs a repaint while typing. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(900px 520px at 18% -8%, rgba(99,102,241,0.13), transparent 60%),' +
            'radial-gradient(760px 460px at 88% 8%, rgba(34,211,238,0.09), transparent 62%)',
        }}
      />

      <AnimatePresence mode="wait">
        {!isWriting && !reading ? (
          /* ── Library ── */
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative max-w-5xl mx-auto px-6 pt-20 pb-20"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl font-light tracking-[0.2em] text-slate-100 flex items-center gap-3">
                  <Moon className="h-5 w-5 text-slate-600" /> SilentBoy
                </h2>
                <p className="text-[11px] text-slate-600 mt-1.5 tracking-[0.3em] uppercase">
                  deep writing · lyrics · poetry
                </p>
                <p className="text-[11px] text-slate-700 mt-2 tabular-nums">
                  {pieces.length} piece{pieces.length === 1 ? '' : 's'} · {totalWords.toLocaleString()}{' '}
                  words
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pieces.length > 4 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-700" />
                    <input
                      id="silentboy-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search…  /"
                      className="h-9 w-44 pl-8 pr-3 text-xs bg-white/[0.03] border border-white/10 rounded-full text-slate-300 outline-none focus:border-slate-600 placeholder:text-slate-700 transition-colors"
                    />
                  </div>
                )}
                <button
                  onClick={startNew}
                  className="flex items-center gap-2 h-9 px-4 text-sm border border-slate-800 rounded-full text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-all"
                >
                  <Plus className="h-4 w-4" /> New Piece
                  <kbd className="text-[9px] text-slate-600 border border-slate-800 rounded px-1">
                    ⌘N
                  </kbd>
                </button>
              </div>
            </div>

            {pieces.length === 0 ? (
              <button
                onClick={startNew}
                className="w-full py-28 text-slate-700 hover:text-slate-400 transition-all text-sm tracking-[0.2em]"
              >
                the silence is waiting — write your first piece
              </button>
            ) : filtered.length === 0 ? (
              <p className="py-20 text-center text-sm text-slate-700 tracking-[0.2em]">
                nothing matches “{query}”
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filtered.map((piece, i) => {
                  const words = countWords(piece.content);
                  return (
                    <motion.div
                      key={piece.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.035, duration: 0.4 }}
                      className="group relative rounded-2xl bg-white/[0.025] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-all"
                    >
                      <button
                        onClick={() => (piece.isLocked ? null : setReading(piece))}
                        disabled={piece.isLocked}
                        className="w-full text-left p-6 rounded-2xl disabled:cursor-default"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className={cn(
                              'inline-block px-2 py-0.5 text-[10px] tracking-widest rounded-full border',
                              moodColor(piece.mood)
                            )}
                          >
                            {piece.mood ?? 'Silent'}
                          </span>
                          {piece.isLocked && (
                            <Lock className="h-3 w-3 text-slate-700" aria-label="Locked" />
                          )}
                        </div>
                        <p
                          className={cn(
                            'text-sm leading-relaxed text-slate-300 line-clamp-5 whitespace-pre-wrap',
                            FONT_CLASS[(piece.fontStyle as FontKey) ?? 'serif']
                          )}
                        >
                          {piece.content}
                        </p>
                        <div className="mt-4 flex items-center gap-2.5 text-[10px] text-slate-600 tracking-wider tabular-nums">
                          <span>
                            {new Date(piece.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          <span className="text-slate-800">·</span>
                          <span>{words} words</span>
                          <span className="text-slate-800">·</span>
                          <span>{readingTime(Math.max(1, Math.round(words / 200)))}</span>
                        </div>
                      </button>

                      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!piece.isLocked && (
                          <button
                            onClick={() => startEdit(piece)}
                            aria-label="Edit"
                            className="p-1.5 text-slate-700 hover:text-slate-300 transition-all"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            confirmDelete === piece.id
                              ? (deleteEntry(piece.id), setConfirmDelete(null))
                              : setConfirmDelete(piece.id)
                          }
                          onBlur={() => setConfirmDelete(null)}
                          aria-label="Delete"
                          className={cn(
                            'p-1.5 transition-all',
                            confirmDelete === piece.id
                              ? 'text-rose-400'
                              : 'text-slate-800 hover:text-rose-400'
                          )}
                        >
                          {confirmDelete === piece.id ? (
                            <span className="text-[9px] tracking-widest pr-1">SURE</span>
                          ) : null}
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <p className="mt-14 text-center text-[10px] text-slate-800 tracking-[0.25em] tabular-nums">
              {monthName} · esc to leave
            </p>
          </motion.div>
        ) : reading ? (
          /* ── Reading ── */
          <motion.div
            key="reading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative max-w-2xl mx-auto px-6 pt-20 pb-24"
          >
            <div className="flex items-center gap-2 mb-10">
              <button
                onClick={() => setReading(null)}
                className="h-9 px-4 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-600 rounded-full transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Library
              </button>
              <button
                onClick={() => startEdit(reading)}
                className="h-9 px-4 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-600 rounded-full transition-all"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <span className="ml-auto text-[10px] text-slate-700 tracking-widest tabular-nums">
                esc to go back
              </span>
            </div>

            <span
              className={cn(
                'inline-block mb-5 px-2 py-0.5 text-[10px] tracking-widest rounded-full border',
                moodColor(reading.mood)
              )}
            >
              {reading.mood ?? 'Silent'}
            </span>
            <p
              className={cn(
                'text-[17px] leading-[1.9] text-slate-300 whitespace-pre-wrap',
                FONT_CLASS[(reading.fontStyle as FontKey) ?? 'serif']
              )}
            >
              {reading.content}
            </p>
            <p className="mt-8 text-[10px] text-slate-700 tracking-widest tabular-nums">
              {new Date(reading.date).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              · {countWords(reading.content)} words
            </p>
          </motion.div>
        ) : (
          /* ── Writing ── */
          <motion.div
            key="writing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-30 bg-[#05060a] flex flex-col"
          >
            {/* Toolbar sits below the global hamburger, so Back is never hidden. */}
            <div className="flex items-center gap-2 px-6 pt-20 pb-3 z-10">
              <button
                onClick={leaveWriting}
                title="Back to Library (Esc)"
                className="h-9 px-4 flex-shrink-0 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-600 rounded-full transition-all bg-black/60 backdrop-blur-md"
              >
                <X className="h-3.5 w-3.5" /> Back
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
                  onClick={() =>
                    setFont((f) => (f === 'serif' ? 'mono' : f === 'mono' ? 'sans' : 'serif'))
                  }
                  title="Toggle font (serif / mono / sans)"
                  className="h-9 px-3 text-xs text-slate-600 hover:text-slate-200 border border-slate-900 hover:border-slate-700 rounded-full transition-all flex items-center gap-2"
                >
                  <Type className="h-3.5 w-3.5" /> {font}
                </button>
                <button
                  onClick={handleSave}
                  title="Save (Ctrl+S)"
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
                'flex-1 min-h-0 w-full bg-transparent text-xl leading-loose resize-none outline-none',
                'max-w-3xl mx-auto block px-8 text-center',
                'placeholder:text-slate-800 caret-cyan-400',
                FONT_CLASS[font]
              )}
            />

            <div
              className={cn(
                'pb-6 pt-2 text-center text-[10px] tracking-widest tabular-nums transition-opacity duration-700',
                isTyping ? 'opacity-0' : 'opacity-100 text-slate-800'
              )}
            >
              {countWords(content)} words · {content.split('\n').length} lines · esc to leave
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Presence dot: the one thing on screen that reacts while you type. */}
      <div
        aria-hidden
        className={cn(
          'fixed top-6 right-6 h-2 w-2 rounded-full transition-all duration-700 pointer-events-none z-20',
          isTyping
            ? 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.8)]'
            : 'bg-slate-800'
        )}
      />
    </div>
  );
}

/** Kept so a future call site can reuse the icon without importing it again. */
export const SilentBoyIcons = { BookOpen };
