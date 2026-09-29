import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, GraduationCap, Moon, Target, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  usePlannerStore,
  PLANNER_SUBJECTS,
  DAY_LABELS,
  commitmentDuration,
  fmtMinutes,
} from '@/stores/plannerStore';
import { cn } from '@/lib/utils';

const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

interface PresetRow {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  days: number[];
  enabled: boolean;
}

export function PlannerOnboarding({ onFinish }: { onFinish: () => void }) {
  const {
    commitments, addCommitment, toggleWeak, weakSubjects, enabledSubjects, toggleSubject,
  } = usePlannerStore();

  const [step, setStep] = useState(0);

  const [presets, setPresets] = useState<PresetRow[]>([
    { key: 'school', label: 'School', startTime: '07:30', endTime: '13:30', days: WEEKDAYS, enabled: true },
    { key: 'sleep', label: 'Sleep', startTime: '22:30', endTime: '06:00', days: ALL_DAYS, enabled: true },
  ]);
  const [customLabel, setCustomLabel] = useState('');
  const [customStart, setCustomStart] = useState('15:00');
  const [customEnd, setCustomEnd] = useState('17:30');
  const [customDays, setCustomDays] = useState<number[]>([1, 3, 5]);

  const updatePreset = (key: string, patch: Partial<PresetRow>) =>
    setPresets((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    addCommitment({ label, startTime: customStart, endTime: customEnd, days: customDays, preset: true });
    setCustomLabel('');
  };

  // Preview free time using presets as they stand now.
  const previewDays = ALL_DAYS.map((d) => {
    let used = 0;
    presets.forEach((p) => {
      if (p.enabled && p.days.includes(d)) used += commitmentDuration(p);
    });
    commitments.forEach((c) => {
      if (c.days.includes(d)) used += commitmentDuration(c);
    });
    return { day: d, free: Math.max(0, 24 * 60 - used) };
  });
  const avgFree = previewDays.reduce((s, x) => s + x.free, 0) / 7;

  const steps = [
    {
      icon: GraduationCap,
      title: 'School & classes',
      subtitle: 'These hours are blocked off every weekday.',
      content: (
        <div className="space-y-3">
          {presets.map((p) => (
            <div key={p.key} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => updatePreset(p.key, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-cyan-500"
                />
                <span className="text-sm font-medium text-white flex-1">{p.label}</span>
                <span className="text-[10px] text-slate-600 tabular-nums">
                  {fmtMinutes(commitmentDuration(p))}/day
                </span>
              </label>
              {p.enabled && (
                <div className="flex items-center gap-2 pl-7">
                  <input
                    type="time"
                    value={p.startTime}
                    onChange={(e) => updatePreset(p.key, { startTime: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-slate-600 text-xs">→</span>
                  <input
                    type="time"
                    value={p.endTime}
                    onChange={(e) => updatePreset(p.key, { endTime: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Clock,
      title: 'Tuition & other commitments',
      subtitle: 'Add anything else that occupies your week — tuition, sports, part-time work.',
      content: (
        <div className="space-y-3">
          {commitments.length > 0 && (
            <div className="space-y-2">
              {commitments.map((c) => (
                <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs">
                  <span className="text-white font-medium flex-1 truncate">{c.label}</span>
                  <span className="text-slate-500 tabular-nums">
                    {c.startTime}–{c.endTime}
                  </span>
                  <span className="text-cyan-500/70">{c.days.map((d) => DAY_LABELS[d]).join(' ')}</span>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 rounded-xl border border-dashed border-slate-700/70 space-y-3">
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="e.g. Physics tuition, Cricket practice…"
              className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none border-b border-white/10 focus:border-cyan-500/50 pb-1.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="time"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
              />
              <span className="text-slate-600 text-xs">→</span>
              <input
                type="time"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-0.5 ml-auto">
                {ALL_DAYS.map((d) => {
                  const on = customDays.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setCustomDays((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d].sort()))}
                      className={cn(
                        'w-6 h-6 rounded text-[10px] font-medium transition-all',
                        on ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-600 hover:text-slate-400'
                      )}
                    >
                      {DAY_LABELS[d][0]}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={addCustom}
                disabled={!customLabel.trim()}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  customLabel.trim()
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                )}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Target,
      title: 'Which subjects are tough?',
      subtitle: 'Weak subjects get a double share of your free time.',
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {PLANNER_SUBJECTS.map((s) => {
              const weak = weakSubjects.includes(s);
              const tracked = enabledSubjects.includes(s);
              return (
                <div
                  key={s}
                  className={cn(
                    'p-3.5 rounded-xl border transition-all',
                    tracked
                      ? weak
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-white/[0.03] border-white/10'
                      : 'bg-white/[0.02] border-white/5 opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{s}</span>
                    {tracked && (
                      <button
                        onClick={() => toggleWeak(s)}
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                          weak
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'border-slate-700 text-slate-500 hover:text-amber-300'
                        )}
                      >
                        {weak ? 'Weak ●' : 'Mark weak'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSubject(s)}
                    className="text-[10px] text-slate-500 hover:text-cyan-300 transition-colors"
                  >
                    {tracked ? '✓ tracked' : '+ track this subject'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-600">
            You can change any of this later — the planner adapts instantly.
          </p>
        </div>
      ),
    },
    {
      icon: Moon,
      title: 'Your balanced week',
      subtitle: 'Here’s the free time your schedule leaves open.',
      content: (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/5 border border-cyan-500/20 text-center">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400/70 mb-1">Average free time per day</p>
            <p className="text-4xl font-bold text-white tabular-nums">{fmtMinutes(avgFree)}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Split across {enabledSubjects.length} subject{enabledSubjects.length === 1 ? '' : 'es'}
              {weakSubjects.length > 0 ? ` — ${weakSubjects.length} marked weak` : ''}
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {previewDays.map(({ day, free }) => {
              const maxFree = Math.max(1, ...previewDays.map((x) => x.free));
              const h = Math.max(8, Math.round((free / maxFree) * 100));
              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div className="w-full h-24 flex items-end">
                    <div
                      className="w-full rounded-md bg-gradient-to-t from-cyan-600 to-cyan-400"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500">{DAY_LABELS[day]}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            The planner divides this free time across your subjects — weak subjects take a double share.
            Time you log in Focus Mode counts towards each subject automatically.
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    // Persist presets when leaving step 0.
    if (step === 0) {
      presets.forEach((p) => {
        const exists = commitments.some((c) => c.label.toLowerCase() === p.label.toLowerCase());
        if (p.enabled && !exists) {
          addCommitment({ label: p.label, startTime: p.startTime, endTime: p.endTime, days: p.days, preset: true });
        }
      });
    }
    if (isLast) {
      onFinish();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative w-full max-w-lg rounded-2xl bg-[#0a1120]/95 border border-white/10 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_-6px_rgba(34,211,238,0.7)]">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">{current.title}</h2>
              <p className="text-xs text-slate-500">{current.subtitle}</p>
            </div>
            <span className="text-[10px] text-slate-600 tabular-nums">{step + 1} / {steps.length}</span>
          </div>
          {/* Progress segments */}
          <div className="flex gap-1.5 mt-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-300',
                  i <= step ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-white/5'
                )}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              {current.content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-white/5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
              step === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-white/5'
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onFinish}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_-4px_rgba(6,182,212,0.6)] hover:scale-105 transition-all"
            >
              {isLast ? (
                <>
                  <Check className="h-4 w-4" /> Start planning
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
