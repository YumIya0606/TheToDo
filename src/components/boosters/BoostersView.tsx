import { useCallback, useState } from 'react';
import { useDismissOnOutside } from '@/lib/useDismiss';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Check, RotateCcw, Zap, Clock, AlertCircle, Play } from 'lucide-react';
import {
  boosterStats, DURATION_PRESETS, formatMinutes, selectSeries, useBoosterStore,
  type BoosterKind, type BoosterSeries,
} from '@/stores/boosterStore';
import { applyBoosterChangeWithStudy, PHYSICS_SUBJECT } from '@/lib/boosterStudy';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { BoosterGrid } from './BoosterGrid';
import { StudyPointerBanner } from './StudyPointerBanner';

type Tab = BoosterKind;
const TABS: { id: Tab; label: string; icon: typeof Zap }[] = [
  { id: 'speed', label: 'Speed Boosters', icon: Zap },
  { id: 'theory', label: 'Theory Boosters', icon: Brain },
];

function presetLabel(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  return `${m}m`;
}

export function BoostersView() {
  const { theme } = useUIStore();
  const [tab, setTab] = useState<Tab>('theory');
  const series = useBoosterStore((s) => selectSeries(s, tab));

  if (!series) return null;
  const light = theme === 'light';

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-3 rounded-2xl shadow-lg',
            light ? 'bg-blue-50 border border-blue-100' : 'bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/20'
          )}>
            <Play className="h-6 w-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Boosters</h1>
            <p className={cn('text-sm mt-0.5', light ? 'text-slate-500' : 'text-slate-400')}>
              Physics tuition video tracker · watch time counts toward {PHYSICS_SUBJECT}
            </p>
          </div>
        </div>
      </header>

      {/* Series tabs */}
      <div className="flex gap-3">
        {TABS.map((t) => {
          const s = useBoosterStore.getState().series.find((x) => x.id === t.id);
          const st = boosterStats(s);
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'btn-press relative flex-1 max-w-xs flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300',
                active
                  ? t.id === 'speed'
                    ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_24px_-8px_rgba(34,211,238,0.5)]'
                    : 'bg-violet-500/10 border-violet-500/40 shadow-[0_0_24px_-8px_rgba(139,92,246,0.5)]'
                  : light
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/25'
              )}
            >
              <t.icon className={cn(
                'h-5 w-5 transition-colors',
                active ? (t.id === 'speed' ? 'text-cyan-400' : 'text-violet-400') : light ? 'text-slate-400' : 'text-slate-500'
              )} />
              <div className="flex-1 text-left">
                <div className={cn('text-sm font-semibold', light ? 'text-slate-900' : 'text-white')}>
                  {t.label}
                </div>
                <div className={cn('text-[11px]', light ? 'text-slate-400' : 'text-slate-500')}>
                  {st.watched} / {st.total} watched
                </div>
              </div>
              {st.left > 0 && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold',
                  active
                    ? t.id === 'speed' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-violet-500/20 text-violet-300'
                    : light ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400'
                )}>
                  {st.left}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <SeriesPanel series={series} kind={tab} light={light} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatPill({
  icon: Icon, label, value, tone, light,
}: {
  icon: typeof Clock; label: string; value: string | number; tone: 'cyan' | 'amber' | 'slate'; light: boolean;
}) {
  const tones = {
    cyan: light ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
    amber: light ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    slate: light ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/[0.04] text-slate-300 border-white/10',
  }[tone];
  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium', tones)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className={cn('font-normal', light ? 'text-slate-400' : 'text-slate-500')}>{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function SeriesPanel({ series, kind, light }: { series: BoosterSeries; kind: BoosterKind; light: boolean }) {
  // Selected individually, not with a bare useBoosterStore(): subscribing to the
  // whole store makes every episode tap re-render this panel and the 460-tile
  // grid with it, which is what made the page feel laggy.
  const setSeriesCount = useBoosterStore((s) => s.setSeriesCount);
  const resetSeries = useBoosterStore((s) => s.resetSeries);
  // Read as its own subscription, and only used for the banner above the grid.
  // The grid below is memoised on the series props, which the pointer never
  // appears in, so a change of study plan costs this banner and zero episode
  // tiles.
  const pointer = useBoosterStore((s) => s.pointer);
  const setPointer = useBoosterStore((s) => s.setPointer);
  const [selected, setSelected] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeMinutes, setRangeMinutes] = useState<number | null>(null);
  const [countEdit, setCountEdit] = useState(false);
  // A count editor that stays open under the cursor after you click away feels
  // broken, so Escape and an outside click both put it away.
  const countRef = useDismissOnOutside<HTMLFormElement>(countEdit, () => setCountEdit(false), {
    escape: false,
  });
  const [countVal, setCountVal] = useState('');

  const st = boosterStats(series);
  const pct = st.total > 0 ? Math.round((st.watched / st.total) * 100) : 0;
  const accent = kind === 'speed' ? '#22d3ee' : '#a78bfa';

  const selectedEp = selected != null ? series.episodes.find((e) => e.num === selected) : undefined;

  // A speed post belongs on the speed tab; a theory or unattributed post is
  // theory work, so each tab shows only the pointer that concerns it.
  const pointerForTab =
    pointer && (kind === 'speed' ? pointer.kind === 'speed' : pointer.kind !== 'speed')
      ? pointer
      : null;

  const onSelect = useCallback((num: number) => setSelected(num), []);

  const handleAdd = useCallback(
    (minutes: number) => applyBoosterChangeWithStudy({ type: 'add', series: kind, minutes }),
    [kind]
  );

  const markRange = (e: React.FormEvent) => {
    e.preventDefault();
    const f = Math.round(Number(rangeFrom));
    const t = Math.round(Number(rangeTo));
    if (!Number.isFinite(f) || !Number.isFinite(t) || f < 1 || f > t || t > st.total || rangeMinutes == null) return;
    applyBoosterChangeWithStudy({ type: 'markRange', series: kind, from: f, to: t, minutes: rangeMinutes });
    setRangeFrom('');
    setRangeTo('');
    setRangeMinutes(null);
  };

  const applyCount = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(countVal);
    if (Number.isFinite(n) && n >= 0) setSeriesCount(kind, Math.round(n));
    setCountVal('');
    setCountEdit(false);
  };

  const rangeValid =
    Number.isFinite(Number(rangeFrom)) &&
    Number.isFinite(Number(rangeTo)) &&
    Number(rangeFrom) >= 1 &&
    Number(rangeTo) >= Number(rangeFrom) &&
    Number(rangeTo) <= st.total &&
    rangeMinutes != null;

  return (
    <div className={cn('rounded-3xl border p-6', light ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10')}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column: stats, episode detail, range tool */}
        <div className="lg:w-72 shrink-0 space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className={light ? 'stroke-slate-100' : 'stroke-white/10'} />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: pct / 100 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  pathLength={1}
                  strokeDasharray="263.9"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums">{pct}%</span>
                <span className={cn('text-[10px]', light ? 'text-slate-400' : 'text-slate-500')}>done</span>
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold">{series.name}</h2>
              <p className={cn('text-sm mt-1', light ? 'text-slate-500' : 'text-slate-400')}>
                {st.watched} of {st.total} watched
              </p>
              <p className={cn('text-xs mt-1 flex items-center gap-1', light ? 'text-slate-400' : 'text-slate-500')}>
                <Clock className="h-3 w-3" />
                {formatMinutes(st.watchedMinutes)} logged
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatPill icon={Check} label="Watched" value={st.watched} tone="cyan" light={light} />
            <StatPill icon={Play} label="To watch" value={st.left} tone="slate" light={light} />
            <StatPill icon={AlertCircle} label="Missed" value={st.missed} tone="amber" light={light} />
          </div>

          {st.missed > 0 && (
            <p className={cn('text-[11px] leading-relaxed', light ? 'text-amber-600/80' : 'text-amber-400/80')}>
              {st.missed} episode{st.missed === 1 ? '' : 's'} below #{st.highest} that you haven't watched.
            </p>
          )}

          {/* Episode detail — click a tile and its length/watched status live here */}
          {selectedEp ? (
            <div className={cn(
              'rounded-2xl border p-3.5 space-y-3',
              light ? 'bg-cyan-50/60 border-cyan-200' : 'bg-cyan-500/[0.06] border-cyan-500/25'
            )}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-bold', light ? 'text-cyan-700' : 'text-cyan-300')}>
                  Episode #{selectedEp.num}
                </span>
                <button
                  onClick={() => applyBoosterChangeWithStudy({ type: 'toggle', series: kind, num: selectedEp.num })}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all',
                    selectedEp.watched
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                  )}
                >
                  <Check className="h-3 w-3" />
                  {selectedEp.watched ? 'Watched' : 'Mark watched'}
                </button>
              </div>
              <div>
                <div className={cn('text-[10px] font-semibold uppercase tracking-widest mb-1.5', light ? 'text-slate-400' : 'text-slate-500')}>
                  Length · now {formatMinutes(selectedEp.minutes)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DURATION_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => applyBoosterChangeWithStudy({ type: 'setMinutes', series: kind, num: selectedEp.num, minutes: m })}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                        selectedEp.minutes === m
                          ? light ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : light
                            ? 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400'
                            : 'bg-white/[0.04] text-slate-300 border-white/10 hover:border-cyan-500/50'
                      )}
                    >
                      {presetLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className={cn('text-[11px]', light ? 'text-slate-400' : 'text-slate-500')}>
              Click an episode to edit its length or mark it watched.
            </p>
          )}

          {/* Range tool */}
          <form onSubmit={markRange} className="space-y-2">
            <label className={cn('text-[10px] font-semibold uppercase tracking-widest', light ? 'text-slate-400' : 'text-slate-500')}>
              Mark a range
            </label>
            <div className="flex items-center gap-2">
              <input
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                inputMode="numeric"
                placeholder="100"
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-sm outline-none border tabular-nums',
                  light ? 'bg-slate-50 border-slate-200 text-slate-700 focus:border-cyan-400' : 'bg-white/[0.04] border-white/10 text-slate-200 focus:border-cyan-500/50'
                )}
              />
              <span className={cn('text-sm', light ? 'text-slate-400' : 'text-slate-500')}>–</span>
              <input
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                inputMode="numeric"
                placeholder="210"
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-sm outline-none border tabular-nums',
                  light ? 'bg-slate-50 border-slate-200 text-slate-700 focus:border-cyan-400' : 'bg-white/[0.04] border-white/10 text-slate-200 focus:border-cyan-500/50'
                )}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRangeMinutes(m)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                    rangeMinutes === m
                      ? light ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : light
                        ? 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400'
                        : 'bg-white/[0.04] text-slate-300 border-white/10 hover:border-cyan-500/50'
                  )}
                >
                  {presetLabel(m)}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!rangeValid}
              className={cn(
                'w-full px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                rangeValid
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_-6px_rgba(6,182,212,0.6)] hover:scale-[1.02]'
                  : light ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed'
              )}
            >
              Mark #{rangeFrom || '…'}–#{rangeTo || '…'} as watched
            </button>
          </form>
        </div>

        {/* Episode grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', light ? 'text-slate-400' : 'text-slate-500')}>
              Episodes · click to edit
            </span>
            {countEdit ? (
              <form
                ref={countRef}
                onSubmit={applyCount}
                // Escape puts it away without changing the count.
                onKeyDown={(e) => { if (e.key === 'Escape') setCountEdit(false); }}
                className="flex items-center gap-1.5"
              >
                <input
                  autoFocus
                  value={countVal}
                  onChange={(e) => setCountVal(e.target.value)}
                  inputMode="numeric"
                  placeholder={String(st.total)}
                  aria-label="Episode count"
                  className={cn(
                    'w-20 rounded-lg px-2 py-1 text-xs outline-none border tabular-nums',
                    light ? 'bg-slate-50 border-slate-200 focus:border-cyan-400' : 'bg-white/[0.04] border-white/10 focus:border-cyan-500/50'
                  )}
                />
                <button type="submit" className="px-2 py-1 rounded-lg text-xs font-semibold bg-cyan-500 text-white">Set</button>
                <button
                  type="button"
                  onClick={() => setCountEdit(false)}
                  className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => { setCountEdit(true); setCountVal(String(st.total)); }}
                className={cn(
                  'text-[11px] font-medium transition-colors',
                  light ? 'text-slate-400 hover:text-cyan-600' : 'text-slate-500 hover:text-cyan-300'
                )}
              >
                {st.total} episodes · fix count
              </button>
            )}
          </div>

          {/* What the channel says to work on next, for this series only. */}
          {pointerForTab && (
            <StudyPointerBanner
              pointer={pointerForTab}
              light={light}
              className="mb-2"
              onJump={(num) => setSelected(num)}
              onClear={() => setPointer(null)}
            />
          )}

          <div
            className={cn(
              'flex-1 min-h-[260px] max-h-[52vh] overflow-y-auto rounded-2xl border p-3',
              light ? 'bg-slate-50/60 border-slate-200' : 'bg-white/[0.02] border-white/5'
            )}
          >
            <BoosterGrid
              episodes={series.episodes}
              highest={st.highest}
              light={light}
              size="md"
              selected={selected}
              onSelect={onSelect}
              onAdd={handleAdd}
            />
          </div>

          {/* Footer actions */}
          <div className="mt-4 pt-4 border-t border-inherit flex items-center gap-3 flex-wrap">
            <button
              onClick={() => resetSeries(kind)}
              className={cn(
                'btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                light ? 'text-slate-400 hover:text-red-500' : 'text-slate-500 hover:text-red-400'
              )}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <div className="flex-1" />
            <span className={cn('text-[11px] flex items-center gap-1.5', light ? 'text-slate-400' : 'text-slate-600')}>
              <Clock className="h-3 w-3" />
              Auto-logs to {PHYSICS_SUBJECT} study time
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
