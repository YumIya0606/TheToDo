import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import {
  Brain, Check, Command, CornerDownLeft, Pin, PinOff, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Priority } from '@/types';
import {
  boosterStats, DURATION_PRESETS, formatMinutes, reduceBoosterAction, useBoosterStore,
  type BoosterAction, type BoosterKind, type BoosterSeries, type StudyPointer,
} from '@/stores/boosterStore';
import { BoosterGrid } from '@/components/boosters/BoosterGrid';
import { StudyPointerBanner } from '@/components/boosters/StudyPointerBanner';

type Mode = 'mini' | 'full';

export type CaptureKind = 'task' | 'note' | 'boosters';
export interface CapturePayload {
  kind: CaptureKind;
  title: string;
  content: string;
  priority: Priority;
}

const PRIORITIES: { value: Priority; label: string; active: string }[] = [
  { value: 'low', label: 'Low', active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
  { value: 'medium', label: 'Medium', active: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' },
  { value: 'high', label: 'High', active: 'bg-orange-500/20 text-orange-300 border-orange-500/50' },
  { value: 'urgent', label: 'Urgent', active: 'bg-red-500/20 text-red-300 border-red-500/50' },
];

const TABS: { kind: CaptureKind; label: string }[] = [
  { kind: 'task', label: 'Task' },
  { kind: 'note', label: 'Note' },
  { kind: 'boosters', label: 'Boosters' },
];

// Rust keeps the mini window at 44px and the full menu at 380px. Scaling the
// panel about its top-right corner makes it unfold from the shape's anchor.
const MINI_SIZE = 44;
const FULL_SIZE = 380;
const MINI_SCALE = MINI_SIZE / FULL_SIZE;

export function QuickCaptureOverlay() {
  const [mode, setMode] = useState<Mode>('mini');
  const [kind, setKind] = useState<CaptureKind>('task');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [justSaved, setJustSaved] = useState(false);
  const [pinned, setPinned] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Dragging the frameless window briefly blurs it — never dismiss mid-drag.
  const isDragging = useRef(false);

  // Touched lazily: a missing IPC bridge must not throw during render, which
  // would take the whole overlay down before it could show anything.
  const win = getCurrentWindow();

  // Rust resets the window to the mini shape (shortcut pressed while the menu
  // was open, or the window hidden). Mirror that state here.
  useEffect(() => {
    const unlisten = listen('qc-mini', () => setMode('mini'));
    return () => {
      unlisten.then((f) => f()).catch(() => {});
    };
  }, []);

  const expand = async () => {
    try {
      await invoke('expand_quick_capture');
    } catch (err) {
      console.error('Failed to expand overlay:', err);
    }
    setMode('full');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const collapse = async () => {
    setMode('mini');
    // Let the panel fold back into the shape before the window shrinks.
    await new Promise((r) => setTimeout(r, 230));
    try {
      await invoke('collapse_quick_capture');
    } catch (err) {
      console.error('Failed to collapse overlay:', err);
    }
  };

  const hideWindow = () => {
    void win.hide();
  };

  // Auto-dismiss the full menu when it loses focus (click anywhere outside).
  // Skipped while dragging or pinned. The mini shape is a handle, so it lingers.
  useEffect(() => {
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        isDragging.current = false;
        if (mode === 'full') inputRef.current?.focus();
      } else if (!isDragging.current && !pinned && mode === 'full') {
        void collapse();
      }
    });
    return () => {
      unlisten.then((f) => f()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, mode]);

  const capture = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    const payload: CapturePayload = {
      kind,
      title: trimmed,
      content: content.trim(),
      priority: kind === 'task' ? priority : 'medium',
    };
    try {
      await emit('quick-capture', payload);
    } catch (err) {
      console.error('Failed to emit capture event:', err);
    }
    setTitle('');
    setContent('');
    setJustSaved(true);
    setTimeout(() => {
      setJustSaved(false);
      hideWindow();
    }, 520);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'full') void collapse();
      else hideWindow();
      return;
    }
    if (kind !== 'boosters' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void capture();
    }
  };

  return (
    <div className="w-screen h-screen relative select-none">
      {/*
        Full menu — anchored at the window's top-right corner (the same spot the
        mini shape occupies), so scaling it about that corner makes the menu look
        like it unfolds from inside the shape.
      */}
      <motion.div
        initial={{ scale: MINI_SCALE, opacity: 0 }}
        animate={mode === 'full' ? { scale: 1, opacity: 1 } : { scale: MINI_SCALE, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 230, damping: 24, mass: 0.9 }}
        style={{ transformOrigin: 'top right' }}
        className={cn('absolute inset-0 p-2', mode === 'full' ? 'pointer-events-auto' : 'pointer-events-none')}
      >
        <div className="relative w-full h-full rounded-2xl overflow-hidden">
          {/* Gradient border glow */}
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-500/50 via-blue-600/30 to-transparent" />
          <div className="relative w-full h-full rounded-2xl bg-[#0a1120] border border-white/10 shadow-[0_16px_44px_rgba(0,0,0,0.55)] flex flex-col">
            {/* Drag handle / header */}
            <div
              data-tauri-drag-region
              onPointerDown={() => { isDragging.current = true; }}
              onPointerUp={() => { isDragging.current = false; }}
              onPointerLeave={() => { isDragging.current = false; }}
              className="flex items-center justify-between px-3.5 py-2.5 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.22em] text-cyan-300/90 uppercase">
                  Quick Capture
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden xs:flex items-center gap-1 text-[10px] text-slate-500">
                  <Command className="h-3 w-3" /> Shift + X
                </span>
                <button
                  onClick={() => setPinned((p) => !p)}
                  className={cn(
                    'p-1 rounded-md transition-colors',
                    pinned ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'
                  )}
                  title={pinned ? 'Unpin — dismisses on click-away' : 'Pin — keep open while clicking away'}
                >
                  {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => void collapse()}
                  className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                  title="Fold back (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="px-3.5 pb-2.5">
              <div className="relative grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/5">
                {TABS.map((tab) => (
                  <button
                    key={tab.kind}
                    onClick={() => setKind(tab.kind)}
                    className={cn(
                      'relative z-10 py-1.5 text-xs font-medium tracking-wide transition-colors rounded-lg',
                      kind === tab.kind ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                    )}
                  >
                    {tab.label}
                    {kind === tab.kind && (
                      <motion.span
                        layoutId="qc-tab"
                        className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-cyan-500/25 to-blue-500/25 border border-cyan-500/40 shadow-[0_0_14px_-4px_rgba(34,211,238,0.5)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            {kind === 'boosters' ? (
              <BoosterPanel />
            ) : (
              <div className="flex-1 px-3.5 flex flex-col gap-2.5 min-h-0">
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoFocus
                  placeholder={kind === 'task' ? 'What do you need to do?' : 'What’s on your mind?'}
                  className="w-full bg-transparent text-base font-medium text-white placeholder-slate-600 outline-none border-b border-white/10 focus:border-cyan-500/60 pb-2 transition-colors"
                />

                <AutoGrowTextarea
                  value={content}
                  onChange={setContent}
                  onKeyDown={onKeyDown}
                  maxHeight={kind === 'task' ? 130 : 260}
                  placeholder={kind === 'task' ? 'Notes (optional)…' : 'Write it down…'}
                  className="w-full resize-none bg-white/[0.03] border border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                />

                <AnimatePresence>
                  {kind === 'task' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-1.5 overflow-hidden flex-wrap"
                    >
                      <span className="text-[10px] uppercase tracking-widest text-slate-600">Priority</span>
                      {PRIORITIES.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setPriority(p.value)}
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all',
                            priority === p.value
                              ? p.active
                              : 'border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Footer */}
            {kind !== 'boosters' && (
              <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-white/5">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <CornerDownLeft className="h-3 w-3" />
                  <span>Enter to capture</span>
                  <span className="mx-1">·</span>
                  <span>Esc to dismiss</span>
                </span>
                <button
                  onClick={() => void capture()}
                  disabled={!title.trim()}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all',
                    title.trim()
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_18px_-4px_rgba(6,182,212,0.7)] hover:scale-105'
                      : 'bg-white/5 text-slate-600 cursor-not-allowed'
                  )}
                >
                  {justSaved ? <Check className="h-3.5 w-3.5" /> : null}
                  {justSaved ? 'Captured' : 'Capture'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/*
        The mini floating shape — the only thing visible in mini mode. Just the
        bare logo (the asset is background-removed, so it floats on nothing) at
        the window's top-right corner, which is exactly where the menu unfolds
        from.
      */}
      <AnimatePresence>
        {mode === 'mini' && (
          <motion.button
            key="mini-shape"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            onClick={() => void expand()}
            className="group absolute top-1 right-1 w-9 h-9 flex items-center justify-center transition-transform duration-300 hover:scale-110"
            title="Open Quick Capture"
          >
            <img
              src="/logo.png"
              alt="TheToDo"
              draggable={false}
              className="w-9 h-9 object-contain transition-all duration-300 group-hover:brightness-110"
              style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))' }}
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Textarea that grows with what you type instead of taking a fixed chunk of the
 * window — small when empty, expanding as the note gets longer, scrolling once
 * it hits the cap.
 */
function AutoGrowTextarea({
  value, onChange, onKeyDown, maxHeight, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  maxHeight: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      rows={2}
      placeholder={placeholder}
      style={{ maxHeight }}
      className={className}
    />
  );
}

/**
 * Compact booster tracker. Keeps a local view of the series (seeded from the
 * store, resynced on focus and via the `booster-state` echo), applies changes
 * optimistically, and emits `booster-action` — the main window owns persistence
 * and the physics study-time connection.
 *
 * Mutation + selection callbacks are intentionally stable (useCallback) so the
 * memoized grid and its 300+ chips never re-render while you type in the range
 * tool — that was the source of the tab's lag.
 */
function BoosterPanel() {
  const [tab, setTab] = useState<BoosterKind>('theory');
  const [view, setView] = useState<BoosterSeries[]>(() => useBoosterStore.getState().series);
  // Kept as its own piece of state, separate from `view`, for the same reason
  // the grid is memoised: a study-plan change must not re-render 460 tiles.
  const [pointer, setPointer] = useState<StudyPointer | null>(
    () => useBoosterStore.getState().pointer
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeMinutes, setRangeMinutes] = useState<number | null>(null);
  const win = getCurrentWindow();

  useEffect(() => {
    const u1 = listen<BoosterSeries[]>('booster-state', (e) => setView(e.payload));
    // The study pointer travels on its own channel so it can never be mistaken
    // for a series change: this is what keeps the grid from re-rendering.
    const u3 = listen<StudyPointer | null>('booster-pointer', (e) => setPointer(e.payload));
    // Resync whenever the window comes back to front — covers edits made in the
    // main app while this overlay was hidden.
    const u2 = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        setView(useBoosterStore.getState().series);
        setPointer(useBoosterStore.getState().pointer);
      }
    });
    return () => {
      u1.then((f) => f()).catch(() => {});
      u2.then((f) => f()).catch(() => {});
      u3.then((f) => f()).catch(() => {});
    };
  }, [win]);

  const series = view.find((s) => s.id === tab);
  // Stats tolerate a missing series, so a bad or absent store shows an empty
  // count rather than throwing and blanking the panel.
  const st = series ? boosterStats(series) : { total: 0, watched: 0, left: 0, missed: 0, highest: 0 };
  const selectedEp = selected != null && series ? series.episodes.find((e) => e.num === selected) : undefined;

  // Stable identity for the grid — chips are memoized, so this is what keeps
  // typing in the range tool from re-rendering every episode tile.
  const act = useCallback((a: BoosterAction) => {
    setView((v) => reduceBoosterAction(v, a));
    void emit('booster-action', a);
  }, []);

  const onSelect = useCallback((num: number) => setSelected((cur) => (cur === num ? null : num)), []);

  const handleAdd = useCallback((minutes: number) => {
    act({ type: 'add', series: tab, minutes });
  }, [act, tab]);

  const markRange = (e: React.FormEvent) => {
    e.preventDefault();
    const f = Math.round(Number(rangeFrom));
    const t = Math.round(Number(rangeTo));
    if (!Number.isFinite(f) || !Number.isFinite(t) || f < 1 || f > t || t > st.total || rangeMinutes == null) return;
    act({ type: 'markRange', series: tab, from: f, to: t, minutes: rangeMinutes });
    setRangeFrom('');
    setRangeTo('');
    setRangeMinutes(null);
  };

  const rangeValid =
    Number.isFinite(Number(rangeFrom)) &&
    Number.isFinite(Number(rangeTo)) &&
    Number(rangeFrom) >= 1 &&
    Number(rangeTo) >= Number(rangeFrom) &&
    Number(rangeTo) <= st.total &&
    rangeMinutes != null;

  const SERIES: { id: BoosterKind; label: string; icon: typeof Zap }[] = [
    { id: 'speed', label: 'Speed', icon: Zap },
    { id: 'theory', label: 'Theory', icon: Brain },
  ];

  return (
    <div className="flex-1 px-3.5 pb-3 flex flex-col gap-2 min-h-0">
      {/* Series switch */}
      <div className="relative grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/5">
        {SERIES.map((s) => {
          const Icon = s.icon;
          const active = tab === s.id;
          return (
            <button
              key={s.id}
              onClick={() => { setTab(s.id); setSelected(null); }}
              className={cn(
                'relative z-10 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors rounded-lg',
                active ? 'text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
              {active && (
                <motion.span
                  layoutId="qc-booster-tab"
                  className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-violet-500/25 to-cyan-500/25 border border-cyan-500/40"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-medium">
          ✓ {st.watched} watched
        </span>
        <span className="px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/10 font-medium">
          {st.left} to watch
        </span>
        {st.missed > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
            {st.missed} missed
          </span>
        )}
        {st.highest > 0 && (
          <span className="ml-auto text-slate-600">caught up to #{st.highest}</span>
        )}
      </div>

    {/* What the channel says to work on next, when it concerns this series.
        Sits above the scroll area, so the grid below is untouched. */}
    {series && pointer && (tab === 'speed' ? pointer.kind === 'speed' : pointer.kind !== 'speed') && (
      <StudyPointerBanner
        pointer={pointer}
        className="mb-1.5 shrink-0"
        onJump={(num) => setSelected(num)}
        onClear={() => {
          setPointer(null);
          void emit('booster-pointer', null);
        }}
      />
    )}

      {/* Episode grid. A missing series renders an explanation rather than an
          empty box, so "nothing here" is never ambiguous. */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] p-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {!series ? (
          <div className="h-full grid place-items-center px-4 text-center">
            <div className="space-y-1.5">
              <p className="text-[12px] text-slate-400">
                No episodes in the {tab} series yet
              </p>
              <p className="text-[10.5px] text-slate-600">
                Add one with the + tile, or fix the count in Boosters.
              </p>
            </div>
          </div>
        ) : series.episodes.length === 0 ? (
          <div className="h-full grid place-items-center px-4 text-center">
            <p className="text-[12px] text-slate-400">
              The {tab} series is empty
            </p>
          </div>
        ) : (
          <BoosterGrid
            episodes={series.episodes}
            highest={st.highest}
            light={false}
            size="sm"
            selected={selected}
            onSelect={onSelect}
            onAdd={handleAdd}
          />
        )}
      </div>

      {/* Episode detail — the length editor for the selected tile. */}
      {selectedEp && (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-cyan-300">EP #{selectedEp.num}</span>
            <span className="text-[10px] text-slate-500">{formatMinutes(selectedEp.minutes)}</span>
            <button
              onClick={() => act({ type: 'toggle', series: tab, num: selectedEp.num })}
              className={cn(
                'ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors',
                selectedEp.watched
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
              )}
            >
              <Check className="h-2.5 w-2.5" />
              {selectedEp.watched ? 'Watched' : 'Mark watched'}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="p-0.5 rounded-md text-slate-600 hover:text-white transition-colors"
              title="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => act({ type: 'setMinutes', series: tab, num: selectedEp.num, minutes: m })}
                className={cn(
                  'px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors',
                  selectedEp.minutes === m
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/[0.04] text-slate-400 border-white/10 hover:border-cyan-500/40 hover:text-cyan-300'
                )}
              >
                {m >= 60 ? `${m / 60}h` : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Range tool — mark a span like 100–210 as watched at one average length. */}
      <form onSubmit={markRange} className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 shrink-0">Range</span>
          <input
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            inputMode="numeric"
            placeholder="100"
            className="w-full min-w-0 rounded-lg px-2 py-1 text-xs outline-none border bg-white/[0.04] border-white/10 text-slate-200 focus:border-cyan-500/50 tabular-nums"
          />
          <span className="text-slate-600">–</span>
          <input
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            inputMode="numeric"
            placeholder="210"
            className="w-full min-w-0 rounded-lg px-2 py-1 text-xs outline-none border bg-white/[0.04] border-white/10 text-slate-200 focus:border-cyan-500/50 tabular-nums"
          />
          <button
            type="submit"
            disabled={!rangeValid}
            className={cn(
              'shrink-0 px-3 py-1 rounded-lg text-xs font-semibold transition-all',
              rangeValid
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            )}
          >
            Mark
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRangeMinutes(m)}
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium border transition-colors',
                rangeMinutes === m
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/[0.04] text-slate-400 border-white/10 hover:border-cyan-500/40 hover:text-cyan-300'
              )}
            >
              {m >= 60 ? `${m / 60}h` : `${m}m`}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
