import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3, Wrench, Trash2, Check } from 'lucide-react';
import { useFocusStore, dayKey } from '@/stores/focusStore';
import { cn } from '@/lib/utils';

const SUBJECTS = ['AL Physics', 'AL Chemistry', 'Combined Maths', 'General English'];

function fmt(seconds: number): string {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Minutes as a friendly value, so an edit does not mean typing seconds. */
function toMinutesText(seconds: number): string {
  return String(Math.max(0, Math.round(seconds / 60)));
}
function fromMinutesText(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 60)) : 0;
}

function lastNDays(n: number): { key: string; label: string; long: string; isToday: boolean }[] {
  const out: { key: string; label: string; long: string; isToday: boolean }[] = [];
  const today = dayKey();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      key: dayKey(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      long: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      isToday: dayKey(d) === today,
    });
  }
  return out;
}

/**
 * Study analytics, with the ability to actually correct a number.
 *
 * The totals are stored per day, so a day can be edited on its own. That matters
 * because a mistimed entry used to look like it had been added to every day at
 * once — there was no way to see, or fix, which day it belonged to.
 */
export function AnalyticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const studyAnalytics = useFocusStore((s) => s.studyAnalytics);
  const editDailyTotal = useFocusStore((s) => s.editDailyTotal);
  const repairAnalytics = useFocusStore((s) => s.repairAnalytics);
  const goalOverrides = useFocusStore((s) => s.goalOverrides);
  const dailyGoalMinutes = useFocusStore((s) => s.dailyGoalMinutes);
  const setDailyGoal = useFocusStore((s) => s.setDailyGoal);
  const clearDailyGoalOverride = useFocusStore((s) => s.clearDailyGoalOverride);

  const [range, setRange] = useState<7 | 14 | 30>(7);
  const [editing, setEditing] = useState<{ key: string; subject: string; value: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const days = useMemo(() => lastNDays(range), [range]);

  const dayTotals = days.map(({ key }) =>
    SUBJECTS.reduce((sum, s) => sum + (studyAnalytics[key]?.[s] ?? 0), 0)
  );
  const maxDay = Math.max(1, ...dayTotals);

  const lifetime = SUBJECTS.map((s) => ({
    name: s,
    seconds: Object.values(studyAnalytics).reduce((sum, day) => sum + (day?.[s] ?? 0), 0),
  }));
  const maxLifetime = Math.max(1, ...lifetime.map((l) => l.seconds));

  const today = dayKey();
  const goal = goalOverrides?.[today] ?? dailyGoalMinutes;

  const commit = () => {
    if (!editing) return;
    editDailyTotal(editing.subject, fromMinutesText(editing.value), editing.key);
    setEditing(null);
  };

  const repair = () => {
    const r = repairAnalytics();
    setNote(
      `Checked your history: ${r.merged} entr${r.merged === 1 ? 'y' : 'ies'} folded into the right day, ` +
        `${r.removedEmpty} empty or unusable removed. Every real total was kept.`
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0a1120]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" /> Study Analytics
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto space-y-6 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              {note && (
                <p className="text-[11.5px] px-3 py-2 rounded-lg bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20 leading-relaxed">
                  {note}
                </p>
              )}

              {/* today's goal */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[13px] font-semibold text-white">Daily goal</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      A fixed target you choose, so the bar means the same thing every day.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={15}
                      max={840}
                      step={15}
                      value={goal}
                      onChange={(e) => setDailyGoal(Number(e.target.value) || 120)}
                      className="w-20 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-sm text-white text-right tabular-nums outline-none focus:border-cyan-500/50"
                    />
                    <span className="text-[11px] text-slate-500">min</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((dayTotals[dayTotals.length - 1] / (goal * 60)) * 100))}%`,
                      background: 'linear-gradient(90deg,#3b82f6,#38bdf8)',
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 tabular-nums">
                  Today: {fmt(dayTotals[dayTotals.length - 1])} of {goal}m
                  {goalOverrides?.[today] && (
                    <button
                      onClick={() => clearDailyGoalOverride(today)}
                      className="ml-2 text-cyan-400 hover:text-cyan-300"
                    >
                      back to the default
                    </button>
                  )}
                </p>
              </div>

              {/* daily bars */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                    Last {range} days
                  </h3>
                  <div className="flex gap-1">
                    {([7, 14, 30] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setRange(n)}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                          range === n
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'text-slate-500 hover:text-slate-300'
                        )}
                      >
                        {n}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-1 h-36 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                  {days.map(({ key, label, long, isToday }, i) => {
                    const secs = dayTotals[i];
                    const pct = (secs / maxDay) * 100;
                    return (
                      <div key={key} className="flex-1 min-w-[26px] flex flex-col items-center gap-1">
                        <span className="text-[9px] text-slate-600 tabular-nums">{fmt(secs)}</span>
                        <div
                          className={cn(
                            'w-full rounded-t transition-[height] duration-500',
                            isToday ? 'bg-cyan-400/70' : 'bg-cyan-500/35'
                          )}
                          style={{ height: `${Math.max(2, pct)}%` }}
                          title={`${long}: ${fmt(secs)}`}
                        />
                        <span
                          className={cn(
                            'text-[9px]',
                            isToday ? 'text-cyan-300' : 'text-slate-600'
                          )}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* per-day, per-subject edit */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2">
                  Edit a day
                </h3>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  Type a number of minutes. Each day is stored on its own, so correcting one day
                  never touches another.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden">
                  {days
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map(({ key, long, isToday }) => (
                      <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                        <p className="text-[11px] font-semibold text-slate-300 mb-1.5">
                          {long}
                          {isToday && <span className="ml-1.5 text-cyan-400 text-[9px]">today</span>}
                        </p>
                        <div className="space-y-1">
                          {SUBJECTS.map((s) => {
                            const secs = studyAnalytics[key]?.[s] ?? 0;
                            const isOpen =
                              editing?.key === key && editing?.subject === s;
                            return (
                              <div key={s} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 flex-1 truncate">
                                  {s}
                                </span>
                                {isOpen ? (
                                  <>
                                    <input
                                      autoFocus
                                      type="number"
                                      min={0}
                                      step={5}
                                      value={editing.value}
                                      onChange={(e) =>
                                        setEditing({ ...editing, value: e.target.value })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commit();
                                        if (e.key === 'Escape') setEditing(null);
                                      }}
                                      className="w-14 bg-white/5 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[11px] text-white text-right outline-none"
                                    />
                                    <button
                                      onClick={commit}
                                      aria-label="Save"
                                      className="p-0.5 text-cyan-400 hover:text-cyan-300"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditing({ key, subject: s, value: toMinutesText(secs) })
                                    }
                                    title="Edit"
                                    className={cn(
                                      'px-1.5 py-0.5 rounded text-[10px] tabular-nums min-w-[38px] transition-colors',
                                      secs > 0
                                        ? 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                                        : 'text-slate-600 hover:text-slate-400'
                                    )}
                                  >
                                    {fmt(secs)}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
                <button
                  onClick={repair}
                  className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-cyan-300 transition-colors"
                >
                  <Wrench className="w-3 h-3" />
                  Check my history for anything in the wrong day
                </button>
              </div>

              {/* lifetime */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-3">
                  All time, by subject
                </h3>
                <div className="space-y-2">
                  {lifetime.map((l) => (
                    <div key={l.name} className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 w-32 shrink-0 truncate">
                        {l.name}
                      </span>
                      <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full rounded bg-gradient-to-r from-cyan-500/60 to-blue-500/40 transition-[width] duration-500"
                          style={{ width: `${(l.seconds / maxLifetime) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-300 tabular-nums w-14 text-right">
                        {fmt(l.seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export { Trash2 };
