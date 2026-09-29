import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sigma, Atom, FlaskConical, BookMarked, CalendarClock, Plus, Trash2, Zap,
  Clock, Sparkles, Target, TrendingUp, Play,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PlannerOnboarding } from './PlannerOnboarding';
import {
  usePlannerStore,
  PLANNER_SUBJECTS,
  DAY_LABELS,
  FULL_DAY_LABELS,
  dayCommitments,
  commitmentDuration,
  freeMinutesForDay,
  allocateSubjects,
  fmtMinutes,
  todayKey,
} from '@/stores/plannerStore';
import { useFocusStore } from '@/stores/focusStore';
import { SEED_TIMETABLE } from '@/lib/seedTimetable';
import { cn } from '@/lib/utils';

const SUBJECT_ICON: Record<string, LucideIcon> = {
  'Combined Maths': Sigma,
  'AL Physics': Atom,
  'AL Chemistry': FlaskConical,
  'General English': BookMarked,
};

const SUBJECT_ACCENT: Record<string, string> = {
  'Combined Maths': 'from-blue-500 to-cyan-400',
  'AL Physics': 'from-orange-500 to-amber-400',
  'AL Chemistry': 'from-emerald-500 to-teal-400',
  'General English': 'from-violet-500 to-fuchsia-400',
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

export function PlannerView() {
  const {
    commitments, reminders, enabledSubjects, weakSubjects, studyRatio, onboarded,
    addCommitment, updateCommitment, removeCommitment,
    addReminder, removeReminder,
    toggleSubject, toggleWeak, setStudyRatio, setOnboarded,
    seedTimetable, toggleOffThisWeek,
  } = usePlannerStore();

  const { studyAnalytics, selectedSubject, currentSessionSeconds, setSubject, toggleFocusMode } = useFocusStore();

  // The selected weekday, and a concrete date for it, so a fortnightly class can
  // be excluded on its off weeks instead of blocking time every week.
  const [day, setDay] = useState(new Date().getDay());
  // The coming week, one Date per weekday, so each pill can show the free time
  // for the week that day actually falls in. Computed in one pass because a
  // hook inside a .map() would break the rules of hooks.
  const weekDates = useMemo(() => {
    const today = new Date();
    const out: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const x = new Date(today);
      x.setDate(today.getDate() + ((d - today.getDay() + 7) % 7));
      out.push(x);
    }
    return out;
  }, []);
  const selectedDate = weekDates[day] ?? new Date();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Quick-add form state
  const [newLabel, setNewLabel] = useState('');
  const [newStart, setNewStart] = useState('15:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newDays, setNewDays] = useState<number[]>(WEEKDAYS);

  // Reminder form state
  const [remSubject, setRemSubject] = useState(enabledSubjects[0] ?? 'Combined Maths');
  const [remTime, setRemTime] = useState('19:00');

  const tKey = todayKey();
  const free = freeMinutesForDay(commitments, day, selectedDate);
  const budget = Math.round(free * studyRatio);
  const allocations = allocateSubjects(free, enabledSubjects, weakSubjects, studyRatio);

  const studiedBySubject: Record<string, number> = {};
  let studiedTotal = 0;
  enabledSubjects.forEach((name) => {
    const db = studyAnalytics[tKey]?.[name] ?? 0;
    const live = name === selectedSubject ? currentSessionSeconds : 0;
    const secs = db + live;
    studiedBySubject[name] = secs;
    studiedTotal += secs;
  });

  const overallPct = budget > 0 ? Math.min(100, Math.round((studiedTotal / budget) * 100)) : 0;

  const startFocusFor = (subject: string) => {
    setSubject(subject);
    toggleFocusMode();
  };

  const handleAddCommitment = () => {
    const label = newLabel.trim();
    if (!label) return;
    addCommitment({ label, startTime: newStart, endTime: newEnd, days: newDays.length ? newDays : [day] });
    setNewLabel('');
  };

  const handleAddReminder = () => {
    addReminder({ subject: remSubject, time: remTime });
  };

  // First visit → walk the user through setup.
  useEffect(() => {
    if (!onboarded) setShowOnboarding(true);
  }, [onboarded]);

  return (
    <div className="space-y-8 pb-16">
      {showOnboarding && (
        <PlannerOnboarding
          onFinish={() => {
            setOnboarded(true);
            setShowOnboarding(false);
          }}
        />
      )}

      <PageHeader
        title="Study Planner"
        subtitle="Log your week, own your free time — balanced across every subject."
      />

      {/* An empty planner offers the real timetable rather than making the
          student retype it. Everything it adds stays editable. */}
      {commitments.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-4 flex flex-wrap items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-cyan-200">Load your tuition timetable</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Adds your {SEED_TIMETABLE.length} weekly classes, including the ones that only run
              every other week. You can rename, retime or delete any of them afterwards.
            </p>
          </div>
          <button
            onClick={seedTimetable}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-200 text-xs font-semibold
                       border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors"
          >
            Load timetable
          </button>
        </motion.div>
      )}

      {/* Day selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {ALL_DAYS.map((d) => {
          const dFree = freeMinutesForDay(commitments, d, weekDates[d]);
          const isToday = d === new Date().getDay();
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn(
                'relative px-4 py-2 rounded-xl text-xs font-medium transition-all border',
                day === d
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-[0_0_16px_-6px_rgba(34,211,238,0.6)]'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600',
                isToday && day !== d && 'text-cyan-500/70'
              )}
            >
              {DAY_LABELS[d]}
              {isToday && (
                <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-cyan-400" />
              )}
              <span className="block text-[9px] tabular-nums opacity-60 mt-0.5">{fmtMinutes(dFree)}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowOnboarding(true)}
          title="Re-run the setup wizard"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" /> Setup guide
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Free time" value={fmtMinutes(free)} hint={FULL_DAY_LABELS[day]} />
        <StatCard icon={Target} label="Study budget" value={fmtMinutes(budget)} hint={`${Math.round(studyRatio * 100)}% of free time`} />
        <StatCard icon={TrendingUp} label="Studied today" value={fmtMinutes(studiedTotal / 60)} hint={tKey} />
        <StatCard icon={Zap} label="Today's progress" value={`${overallPct}%`} hint={overallPct >= 100 ? 'Goal hit! 🎉' : `${fmtMinutes((budget - studiedTotal / 60) || 0)} to go`} />
      </div>

      {/* Overall progress bar */}
      <div className="p-6 rounded-2xl bg-[#060f1c]/50 border border-slate-800">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">Today's study goal</h3>
          <span className="text-xs text-slate-500 tabular-nums">
            {fmtMinutes(studiedTotal / 60)} / {fmtMinutes(budget)}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${overallPct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Subject allocation */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Subject balance</h3>
          <span className="text-xs text-slate-500">
            Weak subjects get a double share
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allocations.map((a) => {
            const Icon = SUBJECT_ICON[a.name] ?? Sigma;
            const studiedMin = (studiedBySubject[a.name] ?? 0) / 60;
            const pct = a.minutes > 0 ? Math.min(100, Math.round((studiedMin / a.minutes) * 100)) : 0;
            const isWeak = weakSubjects.includes(a.name);
            return (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="group card-3d p-5 rounded-2xl bg-[#060f1c]/50 border border-slate-800 hover:border-slate-700 overflow-hidden"
              >
                <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-70', SUBJECT_ACCENT[a.name])} />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', SUBJECT_ACCENT[a.name])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{a.name}</p>
                      <p className="text-[10px] text-slate-500">{fmtMinutes(a.minutes)} planned · {FULL_DAY_LABELS[day]}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWeak(a.name)}
                    title={isWeak ? 'Remove weak tag' : 'Mark as weak — double time share'}
                    className={cn(
                      'px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                      isWeak
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'border-slate-700 text-slate-600 hover:text-amber-300 hover:border-amber-500/40'
                    )}
                  >
                    Weak
                  </button>
                </div>

                <div className="flex justify-between items-center text-[11px] mb-1.5">
                  <span className="text-slate-400 tabular-nums">{fmtMinutes(studiedMin)} studied</span>
                  <span className="text-slate-600 tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', SUBJECT_ACCENT[a.name])}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <button
                  onClick={() => startFocusFor(a.name)}
                  className={cn(
                    'w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                    selectedSubject === a.name
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-cyan-500/15 hover:text-cyan-300 hover:border-cyan-500/40'
                  )}
                >
                  <Play className="h-3 w-3" />
                  {selectedSubject === a.name ? 'Continue in Focus Mode' : 'Start Focus Session'}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Subject toggles */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest text-slate-600">Tracked subjects</span>
          {PLANNER_SUBJECTS.map((s) => {
            const on = enabledSubjects.includes(s);
            return (
              <button
                key={s}
                onClick={() => toggleSubject(s)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-medium border transition-all',
                  on
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    : 'border-slate-800 text-slate-600 hover:text-slate-400'
                )}
              >
                {on ? '●' : '○'} {s}
              </button>
            );
          })}
        </div>
      </section>

      {/* Commitments + Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commitments */}
        <section className="p-6 rounded-2xl bg-[#060f1c]/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Time commitments</h3>
            <span className="text-[10px] text-slate-600">{FULL_DAY_LABELS[day]}</span>
          </div>

          <div className="space-y-2 mb-4">
      {dayCommitments(commitments, day, selectedDate).length === 0 && (
        <p className="text-xs text-slate-600 italic py-3 text-center">
          Nothing scheduled on {FULL_DAY_LABELS[day]} — all 24h are free.
        </p>
      )}
      {dayCommitments(commitments, day, selectedDate).map((c) => (
              <div key={c.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={c.label}
                    onChange={(e) => updateCommitment(c.id, { label: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none border-b border-transparent focus:border-cyan-500/50 pb-0.5"
                  />
                  <span className="text-[10px] text-slate-600 tabular-nums whitespace-nowrap">
                    {fmtMinutes(commitmentDuration(c))}
                  </span>
                  <button
                    onClick={() => removeCommitment(c.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="time"
                    value={c.startTime}
                    onChange={(e) => updateCommitment(c.id, { startTime: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
                  />
                  <span className="text-slate-600 text-[11px]">→</span>
                  <input
                    type="time"
                    value={c.endTime}
                    onChange={(e) => updateCommitment(c.id, { endTime: e.target.value })}
                    className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
                  />
                  <div className="flex gap-0.5 ml-auto">
                    {ALL_DAYS.map((d) => {
                      const on = c.days.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            updateCommitment(c.id, { days: on ? c.days.filter((x) => x !== d) : [...c.days, d].sort() })
                          }
                          className={cn(
                            'w-5 h-5 rounded text-[9px] font-medium transition-all',
                            on
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-white/5 text-slate-600 hover:text-slate-400'
                          )}
                        >
                          {DAY_LABELS[d][0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recurrence: an alternate-week class must not block time on
                    its off weeks, and the student often knows this week is the
                    break before any anchor is set. */}
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  <button
                    onClick={() =>
                      updateCommitment(c.id, {
                        cadence: c.cadence === 'fortnightly' ? 'weekly' : 'fortnightly',
                      })
                    }
                    className={cn(
                      'px-2 py-0.5 rounded border transition-colors',
                      c.cadence === 'fortnightly'
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/5 text-slate-500 hover:text-slate-300'
                    )}
                    title="Alternate-week classes only block time on the weeks they actually run"
                  >
                    {c.cadence === 'fortnightly' ? 'Every 2 weeks' : 'Weekly'}
                  </button>

                  {c.cadence === 'fortnightly' && (
                    <button
                      onClick={() => toggleOffThisWeek(c.id)}
                      className={cn(
                        'px-2 py-0.5 rounded border transition-colors',
                        c.offThisWeek
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                          : 'border-white/10 bg-white/5 text-slate-500 hover:text-slate-300'
                      )}
                      title="Mark this week as the break, and free the time up"
                    >
                      {c.offThisWeek ? 'Off this week' : 'Not this week'}
                    </button>
                  )}

                  {c.subject && (
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-500">
                      {c.subject}
                    </span>
                  )}
                  {c.source === 'classradar' && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                      from ClassRadar
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add commitment */}
          <div className="p-3 rounded-xl border border-dashed border-slate-700/70 space-y-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCommitment()}
              placeholder="Add a commitment (e.g. Physics class, Sleep, Cricket)…"
              className="w-full bg-transparent text-sm text-white placeholder-slate-600 outline-none border-b border-white/10 focus:border-cyan-500/50 pb-1.5"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
              />
              <span className="text-slate-600 text-[11px]">→</span>
              <input
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-0.5">
                {ALL_DAYS.map((d) => {
                  const on = newDays.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => setNewDays((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d].sort()))}
                      className={cn(
                        'w-5 h-5 rounded text-[9px] font-medium transition-all',
                        on ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-600 hover:text-slate-400'
                      )}
                    >
                      {DAY_LABELS[d][0]}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleAddCommitment}
                disabled={!newLabel.trim()}
                className={cn(
                  'ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  newLabel.trim()
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-105'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                )}
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          </div>
        </section>

        {/* Reminders + intensity */}
        <section className="p-6 rounded-2xl bg-[#060f1c]/50 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Study reminders</h3>
            <span className="text-[10px] text-slate-600">Fire once per day</span>
          </div>

          <div className="space-y-2 mb-4">
            {reminders.length === 0 && (
              <p className="text-xs text-slate-600 italic py-3 text-center">
                No reminders yet — add one and the app will nudge you daily.
              </p>
            )}
            {reminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-300">
                  <CalendarClock className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{r.subject}</p>
                  {r.message && <p className="text-[10px] text-slate-500 truncate">{r.message}</p>}
                </div>
                <span className="text-xs text-cyan-300/80 tabular-nums">{r.time}</span>
                <button
                  onClick={() => removeReminder(r.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-6">
            <select
              value={remSubject}
              onChange={(e) => setRemSubject(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
            >
              {PLANNER_SUBJECTS.map((s) => (
                <option key={s} value={s} className="bg-slate-900">
                  {s}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={handleAddReminder}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:scale-105 transition-all"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          {/* Study intensity */}
          <div className="pt-4 border-t border-white/5">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-slate-300">Study intensity</label>
              <span className="text-xs text-cyan-300 tabular-nums">{Math.round(studyRatio * 100)}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(studyRatio * 100)}
              onChange={(e) => setStudyRatio(Number(e.target.value) / 100)}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-600 mt-1.5">
              Share of free time allocated to study — the rest stays open for meals, rest and buffer.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, hint,
}: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="card-3d relative p-4 rounded-2xl bg-[#060f1c]/50 border border-slate-800 overflow-hidden">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-cyan-500/5 blur-2xl" />
      <div className="flex items-center gap-2 mb-2">
        <Icon className="icon-pop h-3.5 w-3.5 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-600 mt-0.5 truncate">{hint}</p>
    </div>
  );
}
