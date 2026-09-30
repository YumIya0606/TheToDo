import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, RefreshCw } from 'lucide-react';
import { ChannelsPanel } from '@/components/classes/ChannelsPanel';
import { EngineConnectionsPanel } from './EngineConnectionsPanel';
import { TelegramCredentials } from '@/components/telegram-creds';
import { useSettingsStore } from '@/stores/settingsStore';
import { defaultSchedulePath } from '@/lib/engine';
import type { ScheduleCounts } from '@/lib/schedule';
import { cn } from '@/lib/utils';

/**
 * Everything about reading your tuition channels, in one place with tabs.
 *
 * It used to be two separate settings sections, one of which described an app
 * that no longer exists separately and pointed at its data folder. Two places to
 * look, and the wrong information in one of them, is worse than one place.
 */
type TabId = 'channels' | 'keys' | 'telegram' | 'schedule';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'channels', label: 'Channels' },
  { id: 'keys', label: 'Connections & keys' },
  { id: 'telegram', label: 'Telegram account' },
  { id: 'schedule', label: 'Schedule file' },
];

export function ChannelsSettings({ onRefresh }: { onRefresh: () => void }) {
  const [tab, setTab] = useState<TabId>('channels');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-[#060f1c]/50 p-6">
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-1">
          <Radio className="h-4 w-4 text-cyan-400" /> Tuition channels
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Your classes and study plan are read from your teachers' Telegram channels, so those
          classes land here with their times, links and actions already worked out.
        </p>

        <div className="flex flex-wrap items-center gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
                tab === t.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="pt-4"
        >
          {tab === 'channels' && <ChannelsPanel onChanged={onRefresh} />}
          {tab === 'keys' && <EngineConnectionsPanel onRefresh={onRefresh} />}
          {tab === 'telegram' && <TelegramCredentials onChanged={onRefresh} />}
          {tab === 'schedule' && <ScheduleFileCard onRefresh={onRefresh} />}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The exported schedule, and how to re-read it.
 *
 * The engine writes one file that the app reads, which means the path is worth
 * showing plainly: it is how you tell a working setup from a broken one.
 */
function ScheduleFileCard({ onRefresh }: { onRefresh: () => void }) {
  const classRadarPath = useSettingsStore((s) => s.classRadarPath);
  const setClassRadarPath = useSettingsStore((s) => s.setClassRadarPath);
  const checkedAt = useSettingsStore((s) => s.classRadarCheckedAt);

  const [path, setPath] = useState('');
  const [draft, setDraft] = useState(classRadarPath ?? '');
  const [state, setState] = useState<'unknown' | 'loading' | 'ok' | 'missing'>('unknown');
  const [counts, setCounts] = useState<ScheduleCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const p = classRadarPath || (await defaultSchedulePath().catch(() => ''));
      if (alive) {
        setPath(p);
        setDraft(classRadarPath ?? '');
      }
    })();
    return () => {
      alive = false;
    };
  }, [classRadarPath]);

  const read = async () => {
    setState('loading');
    setError(null);
    try {
      const { readScheduleFile } = await import('@/lib/schedule');
      const r = await readScheduleFile();
      if (!r.ok) {
        setState('missing');
        setError(r.error);
        return;
      }
      setCounts(r.counts);
      setState('ok');
      onRefresh();
    } catch (e) {
      setState('missing');
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (path) void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-300">Schedule file</p>
          <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
            {path || 'not found'}
          </p>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium border shrink-0',
            state === 'ok'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
              : state === 'loading'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                : state === 'missing'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                  : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
          )}
        >
          {state === 'ok'
            ? 'read'
            : state === 'loading'
              ? 'reading…'
              : state === 'missing'
                ? 'no data'
                : 'unknown'}
        </span>
      </div>

      {counts && (
        <p className="text-[11px] text-slate-500">
          {counts.classes ?? 0} classes · {counts.studyPlan ?? 0} study-plan posts ·{' '}
          {counts.understood ?? 0} of {counts.messages ?? 0} messages understood
          {checkedAt ? ` · checked ${new Date(checkedAt).toLocaleString('en-GB')}` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={read}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs
                     font-medium border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', state === 'loading' && 'animate-spin')} />
          Read the schedule
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={path || 'the default location'}
          className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5
                     text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={() => setClassRadarPath(draft.trim() || null)}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-medium
                     border border-white/10 hover:bg-white/10 transition-colors"
        >
          Use this path
        </button>
        {classRadarPath && (
          <button
            onClick={() => {
              setClassRadarPath(null);
              setDraft('');
            }}
            className="px-2 py-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {error && <p className="text-[11px] text-amber-300/80 leading-relaxed">{error}</p>}

      <p className="text-[11px] text-slate-600 leading-relaxed">
        The reading engine writes this file. Everything the app knows about your classes comes from
        it, so if it is missing, open the Connections tab and start the engine.
      </p>
    </div>
  );
}
