import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Plus,
  RefreshCw,
  Video,
  FileText,
  Zap,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { usePlannerStore } from '@/stores/plannerStore';
import { useBoosterStore } from '@/stores/boosterStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { emit } from '@tauri-apps/api/event';
import {
  fmtDate,
  fmtRange,
  isUpcoming,
  loadSchedule,
  todayISO,
  toPlannerSubject,
  toStudyPointer,
  type RadarBooster,
  type RadarEvent,
  type ScheduleExport,
} from '@/lib/classRadar';
import { cn } from '@/lib/utils';

type Tab = 'classes' | 'study-plan';

const KIND_LABEL: Record<string, string> = {
  zoom: 'Zoom',
  youtube: 'Video',
  pdf: 'PDF',
  drive: 'Drive',
  form: 'Form',
  tg: 'Telegram',
  website: 'Web',
  web: 'Link',
};

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  rescheduled: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  postponed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  started: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completed: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
};

export function ClassesView() {
  const [data, setData] = useState<ScheduleExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('classes');
  const [open, setOpen] = useState<number | null>(null);
  const [added, setAdded] = useState<Record<number, boolean>>({});

  const classRadarPath = useSettingsStore((s) => s.classRadarPath);
  const setClassRadarPath = useSettingsStore((s) => s.setClassRadarPath);
  const lastChecked = useSettingsStore((s) => s.classRadarCheckedAt);
  const commitments = usePlannerStore((s) => s.commitments);
  const addCommitment = usePlannerStore((s) => s.addCommitment);

  const refresh = async () => {
    setLoading(true);
    const r = await loadSchedule(true);
    setPath(r.path);
    if (r.ok && r.data) {
      setData(r.data);
      setError(null);
      applyPointer(r.data.boosterPlan);
    } else {
      setData(null);
      setError(r.error);
    }
    setLoading(false);
  };

  /**
   * Hand the newest study-plan post to the booster tracker.
   *
   * This writes a single store field, and the episode grid is memoised on the
   * series, so no episode tile re-renders when the study plan changes. The
   * pointer is also emitted so the Quick Capture overlay shows the same thing.
   */
  const applyPointer = (plan: RadarBooster[]) => {
    const next = toStudyPointer(plan);
    const before = useBoosterStore.getState().pointer;
    if (next?.episode === before?.episode && next?.tute === before?.tute) return;
    useBoosterStore.getState().setPointer(next);
    void emit('booster-pointer', next);
  };

  useEffect(() => {
    void (async () => {
      const r = await loadSchedule();
      setPath(r.path);
      if (r.ok && r.data) {
        setData(r.data);
        setError(null);
        applyPointer(r.data.boosterPlan);
      } else {
        setError(r.error);
      }
      setLoading(false);
    })();
  }, []);

  const today = todayISO();

  const upcoming = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => isUpcoming(e, today))
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [data, today]
  );

  const past = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => !isUpcoming(e, today))
        .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    [data, today]
  );

  /**
   * A class ClassRadar read that the planner has no block for. Offered as a
   * one-click commitment rather than added automatically: the planner is the
   * student's own record of their week, and a class that moved for one week is
   * not a permanent weekly commitment.
   */
  const known = useMemo(() => {
    const set = new Set<string>();
    for (const c of commitments) {
      set.add(`${c.label.trim().toLowerCase()}|${c.startTime}`);
    }
    return set;
  }, [commitments]);

  const addToPlanner = (e: RadarEvent) => {
    if (!e.startTime || !e.endTime) return;
    const label = e.title;
    addCommitment({
      label,
      startTime: e.startTime,
      endTime: e.endTime,
      days: [new Date(`${e.date}T00:00:00`).getDay()],
      subject: toPlannerSubject(e.subject),
      source: 'classradar',
    });
    setAdded((a) => ({ ...a, [e.id]: true }));
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Classes"
        subtitle="Read from your tuition channels by ClassRadar, in the words it actually used."
      />

      {/* Connection */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-200">ClassRadar</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{path || 'not configured'}</p>
            {lastChecked && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                last read {new Date(lastChecked).toLocaleString('en-GB')}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15
                       text-cyan-300 text-xs font-medium border border-cyan-500/30
                       hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Reading…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              {error}
              {' '}Open ClassRadar and press <strong>Export schedule</strong> on the Study plan
              screen, then press Refresh here.
            </span>
          </div>
        )}

        <details className="text-[11px] text-slate-500">
          <summary className="cursor-pointer hover:text-slate-300 transition-colors">
            Schedule file location
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              value={classRadarPath ?? ''}
              placeholder="C:\Users\...\AppData\Roaming\ClassRadar\data\schedule.json"
              onChange={(e) => setClassRadarPath(e.target.value)}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-md px-2 py-1
                         text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
            />
          </div>
        </details>
      </div>

      {data && (
        <>
          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Upcoming" value={upcoming.length} accent />
            <Stat label="Study plan" value={data.counts.boosterPosts} />
            <Stat label="Links" value={data.counts.links} />
            <Stat label="Understood" value={data.counts.understood} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 border-b border-white/10">
            {(
              [
                ['classes', `Classes (${upcoming.length})`, CalendarClock],
                ['study-plan', `Study plan (${data.boosterPlan.length})`, Zap],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                  tab === key
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tab === 'classes' ? (
            <div className="space-y-6">
              <EventList
                title="Upcoming"
                events={upcoming}
                open={open}
                setOpen={setOpen}
                today={today}
                known={known}
                added={added}
                onAdd={addToPlanner}
                emptyText="Nothing announced for the days ahead. Press Sync in ClassRadar."
              />
              {past.length > 0 && (
                <EventList
                  title="Recent"
                  events={past.slice(0, 20)}
                  open={open}
                  setOpen={setOpen}
                  today={today}
                  known={known}
                  added={added}
                  onAdd={addToPlanner}
                  emptyText=""
                />
              )}
            </div>
          ) : (
            <StudyPlanList plan={data.boosterPlan} />
          )}

          {data.notes.length > 0 && (
            <div className="text-[10.5px] text-slate-600 space-y-1">
              {data.notes.map((n, i) => (
                <p key={i}>· {n}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums mt-0.5', accent ? 'text-cyan-300' : 'text-white')}>
        {value}
      </p>
    </div>
  );
}

function EventList({
  title,
  events,
  open,
  setOpen,
  today,
  known,
  added,
  onAdd,
  emptyText,
}: {
  title: string;
  events: RadarEvent[];
  open: number | null;
  setOpen: (id: number | null) => void;
  today: string;
  known: Set<string>;
  added: Record<number, boolean>;
  onAdd: (e: RadarEvent) => void;
  emptyText: string;
}) {
  if (events.length === 0) {
    return emptyText ? (
      <p className="text-xs text-slate-600 italic py-4 text-center">{emptyText}</p>
    ) : null;
  }
  return (
    <div>
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
        {title}
      </h2>
      <div className="space-y-1.5">
        {events.map((e) => (
          <EventRow
            key={e.id}
            event={e}
            expanded={open === e.id}
            onToggle={() => setOpen(open === e.id ? null : e.id)}
            isToday={e.date === today}
            inPlanner={known.has(`${e.title.trim().toLowerCase()}|${e.startTime}`)}
            alreadyAdded={Boolean(added[e.id])}
            onAdd={() => onAdd(e)}
          />
        ))}
      </div>
    </div>
  );
}

function EventRow({
  event: e,
  expanded,
  onToggle,
  isToday,
  inPlanner,
  alreadyAdded,
  onAdd,
}: {
  event: RadarEvent;
  expanded: boolean;
  onToggle: () => void;
  isToday: boolean;
  inPlanner: boolean;
  alreadyAdded: boolean;
  onAdd: () => void;
}) {
  const subject = toPlannerSubject(e.subject);
  const canAdd = Boolean(e.startTime && e.endTime) && !inPlanner && !alreadyAdded;

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl border overflow-hidden transition-colors',
        expanded
          ? 'border-cyan-500/30 bg-cyan-500/[0.05]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
      )}
    >
      <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-start gap-3">
        <div className="w-14 shrink-0">
          <p className={cn('text-xs font-semibold', isToday ? 'text-cyan-300' : 'text-slate-300')}>
            {fmtDate(e.date)}
          </p>
          <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">{fmtRange(e)}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm text-white font-medium truncate">{e.title}</span>
            {e.isFullSyllabus && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                Full syllabus
              </span>
            )}
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-medium border',
                STATUS_STYLE[e.status] ?? STATUS_STYLE.scheduled
              )}
            >
              {e.status}
            </span>
          </div>
          {e.action && <p className="text-[11px] text-amber-300/80 mt-0.5">→ {e.action}</p>}
        </div>

        <ChevronDown
          className={cn('h-4 w-4 text-slate-600 shrink-0 mt-0.5 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-white/10 px-3 py-2.5 space-y-2.5"
        >
          {e.note && <p className="text-[12px] text-slate-400 leading-relaxed">{e.note}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-400">{subject}</span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-400">
              {e.classType}
            </span>
            {canAdd && (
              <button
                onClick={onAdd}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                           bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add to Planner
              </button>
            )}
            {inPlanner && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25">
                <CheckCircle2 className="h-3 w-3" />
                In your Planner
              </span>
            )}
            {alreadyAdded && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/25">
                <CheckCircle2 className="h-3 w-3" />
                Added
              </span>
            )}
          </div>

          {e.links.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {e.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px]
                             bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
                >
                  {l.kind === 'zoom' || l.kind === 'youtube' ? (
                    <Video className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  {KIND_LABEL[l.kind] ?? 'Link'}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              ))}
            </div>
          )}

          {e.sources.length > 0 && (
            <details className="text-[11px]">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-300 transition-colors">
                {e.sources.length} source message{e.sources.length > 1 ? 's' : ''} from the channel
              </summary>
              <div className="mt-2 space-y-1.5">
                {e.sources.map((s) => (
                  <div key={s.messageId} className="rounded-lg bg-white/[0.03] border border-white/10 p-2">
                    <p className="text-[10px] font-mono text-slate-500">@{s.channel}</p>
                    {s.headline && <p className="text-[11.5px] text-slate-300 mt-0.5">{s.headline}</p>}
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{s.original}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * The daily "which questions, which tute, which episode" posts. Kept on its own
 * tab because it is study planning rather than a class, and mixing the two made
 * both harder to read.
 */
function StudyPlanList({ plan }: { plan: RadarBooster[] }) {
  if (plan.length === 0) {
    return (
      <p className="text-xs text-slate-600 italic py-4 text-center">
        No study plan read yet. ClassRadar picks these up from the physics theory channel.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {plan.map((b, i) => (
        <div
          key={`${b.postedAt}-${i}`}
          className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 flex items-start gap-3"
        >
          <div className="w-14 shrink-0">
            <p className="text-[10px] font-mono text-slate-500">
              {new Date(b.postedAt * 1000).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
            {b.episode != null && (
              <p className="text-xs font-semibold text-cyan-300 mt-0.5">EP {b.episode}</p>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {b.kind && b.kind !== 'unknown' && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-medium border',
                    b.kind === 'speed'
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                  )}
                >
                  {b.kind} booster
                </span>
              )}
              {b.tute && (
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400">
                  {b.tute}
                </span>
              )}
              {(b.questions?.length ?? 0) > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400"
                  title={b.questions.join(', ')}
                >
                  {b.questions.length} question{b.questions.length === 1 ? '' : 's'}:{' '}
                  {b.questions.slice(0, 8).join(', ')}
                  {b.questions.length > 8 ? ` +${b.questions.length - 8} more` : ''}
                </span>
              )}
            </div>
            {b.questions?.length ? (
              <p className="text-[10.5px] text-slate-500 mt-1 font-mono">
                {b.questions.join(', ')}
              </p>
            ) : null}
            {b.headline && <p className="text-[12.5px] text-slate-300 mt-1">{b.headline}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
