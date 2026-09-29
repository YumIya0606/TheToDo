import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
} from 'lucide-react';
import { engine, engineAlive, type EngineState } from '@/lib/engine';
import { cn } from '@/lib/utils';

interface EngineChannel {
  id: number;
  username: string;
  title: string;
  subject: string;
  teacher: string;
  kind: string;
  accent: string;
  enabled: number;
  last_sync_at: number | null;
  last_scanned_id: number;
  member_count: number | null;
}

interface Stats {
  id: number;
  messages: number;
  understood: number;
  rulesOnly: number;
  events: number;
  links: number;
}

/** The reading channels, with what has actually been read from each. */
export function ChannelsPanel({ onChanged }: { onChanged: () => void }) {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [channels, setChannels] = useState<EngineChannel[]>([]);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [state, setState] = useState<EngineState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!(await engineAlive())) {
      setAlive(false);
      return;
    }
    try {
      const [c, s, st] = await Promise.all([engine.channels(), engine.coverage(), engine.state()]);
      setChannels(c as unknown as EngineChannel[]);
      setStats(s as unknown as Record<number, Stats>);
      setState(st);
      setAlive(true);
    } catch (e) {
      setAlive(false);
      setMsg({ tone: 'bad', text: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (alive === false) {
    return (
      <p className="text-[12px] text-slate-500 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
        Channel coverage appears once the reading engine is running. Start it from{' '}
        <span className="text-cyan-300">API keys &amp; connections</span> above.
      </p>
    );
  }

  if (!channels.length) {
    return (
      <div className="h-20 panel shimmer relative overflow-hidden rounded-xl" />
    );
  }

  const totals = channels.reduce(
    (a, c) => {
      const s = stats[c.id];
      a.messages += s?.messages ?? 0;
      a.understood += s?.understood ?? 0;
      a.links += s?.links ?? 0;
      return a;
    },
    { messages: 0, understood: 0, links: 0 }
  );
  const pct = totals.messages ? Math.round((totals.understood / totals.messages) * 100) : 0;
  const unreadable = channels.filter((c) => c.enabled && c.last_scanned_id === 0);

  const setEnabled = async (c: EngineChannel, enabled: boolean) => {
    setBusy(`t${c.id}`);
    setChannels((prev) => prev.map((x) => (x.id === c.id ? { ...x, enabled: enabled ? 1 : 0 } : x)));
    try {
      await engine.setChannelEnabled(c.id, enabled);
      await load();
      onChanged();
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const syncOne = async (c: EngineChannel) => {
    setBusy(`s${c.id}`);
    setMsg(null);
    try {
      await engine.syncChannel(c.username);
      await load();
      onChanged();
      setMsg({ tone: 'ok', text: `Read @${c.username} from its newest message back.` });
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* connection + totals */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
        <div
          className={cn(
            'px-2 py-0.5 rounded text-[9.5px] font-medium ring-1 shrink-0',
            state?.authenticated
              ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
              : 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
          )}
        >
          {state?.authenticated ? 'account connected' : 'web preview only'}
        </div>
        <div className="text-[11.5px] text-slate-400 tabular-nums">
          {totals.messages.toLocaleString()} messages · {totals.understood.toLocaleString()} read ·{' '}
          {totals.links.toLocaleString()} links
        </div>
        <div className="flex-1 min-w-[90px] h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? 'linear-gradient(90deg,#34d399,#22d3ee)' : 'linear-gradient(90deg,#3b82f6,#38bdf8)',
            }}
          />
        </div>
        <span className="text-[10.5px] text-slate-500 tabular-nums">{pct}% read</span>
        <button
          onClick={async () => {
            setBusy('all');
            try {
              await engine.syncAll();
              await load();
              onChanged();
            } catch (e) {
              setMsg({ tone: 'bad', text: (e as Error).message });
            } finally {
              setBusy(null);
            }
          }}
          disabled={busy === 'all'}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 text-[11px]
                     font-medium border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy === 'all' && 'animate-spin')} />
          Read all
        </button>
      </div>

      {!state?.authenticated && unreadable.length > 0 && (
        <p className="flex items-start gap-2 text-[11.5px] text-amber-200/85 bg-amber-500/[0.08] border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
          <Lock className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            {unreadable.length} channel{unreadable.length === 1 ? '' : 's'} cannot be read yet:{' '}
            {unreadable.map((c) => `@${c.username}`).join(', ')}. Those channels do not publish a
            public web preview, so they need your Telegram account connected. The others are already
            being read.
          </span>
        </p>
      )}

      {msg && (
        <p
          className={cn(
            'text-[11.5px] px-3 py-2 rounded-lg ring-1',
            msg.tone === 'ok'
              ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20'
              : 'bg-rose-500/10 text-rose-200 ring-rose-500/20'
          )}
        >
          {msg.text}
        </p>
      )}

      {/* per channel */}
      <div className="grid gap-2 md:grid-cols-2">
        {channels.map((c, i) => {
          const s = stats[c.id];
          const unread = c.enabled && c.last_scanned_id === 0;
          const p = s?.messages ? Math.round((s.understood / s.messages) * 100) : 0;
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03 }}
              className={cn(
                'rounded-xl border p-3.5 transition-colors',
                unread
                  ? 'border-amber-500/20 bg-amber-500/[0.04]'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: c.accent }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={`https://t.me/${c.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12.5px] font-semibold hover:underline inline-flex items-center gap-1"
                      style={{ color: c.accent }}
                    >
                      @{c.username}
                      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                    </a>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400 capitalize">
                      {c.kind}
                    </span>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px]',
                        c.subject === 'physics'
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : c.subject === 'combined_maths'
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-white/5 text-slate-400'
                      )}
                    >
                      {c.subject === 'physics'
                        ? 'Physics'
                        : c.subject === 'combined_maths'
                          ? 'Combined Maths'
                          : c.subject}
                    </span>
                    {unread && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-300">
                        needs account
                      </span>
                    )}
                    {c.enabled === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-500/15 text-slate-400">
                        paused
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">{c.title}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 flex flex-wrap gap-x-2.5">
                    <span>{c.teacher}</span>
                    {c.member_count ? <span>{(c.member_count / 1000).toFixed(1)}K members</span> : null}
                    <span className="font-mono">
                      {c.last_sync_at ? fmtAgo(c.last_sync_at) : 'never read'}
                    </span>
                    {c.last_scanned_id > 0 && (
                      <span className="font-mono">up to #{c.last_scanned_id}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void syncOne(c)}
                    disabled={busy === `s${c.id}` || c.enabled === 0}
                    title="Read this channel from its newest message back"
                    className="p-1.5 rounded-md text-slate-600 hover:text-cyan-300 hover:bg-white/5
                               transition-colors disabled:opacity-30"
                  >
                    <Send className={cn('h-3.5 w-3.5', busy === `s${c.id}` && 'animate-pulse')} />
                  </button>
                  <button
                    onClick={() => void setEnabled(c, c.enabled === 0)}
                    title={c.enabled === 1 ? 'Pause reading this channel' : 'Resume reading'}
                    className="p-1.5 rounded-md text-slate-600 hover:text-slate-200 hover:bg-white/5
                               transition-colors"
                  >
                    {c.enabled === 1 ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* coverage */}
              {s && s.messages > 0 && (
                <div className="mt-2.5 pl-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${p}%`,
                          background:
                            p === 100
                              ? 'linear-gradient(90deg,#34d399,#22d3ee)'
                              : 'linear-gradient(90deg,#3b82f6,#38bdf8)',
                        }}
                      />
                    </div>
                    <span className="text-[9.5px] text-slate-500 font-mono tabular-nums">
                      {s.understood}/{s.messages}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[9.5px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-2.5 w-2.5" /> {s.messages}
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400/80">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {s.understood} read
                    </span>
                    {s.rulesOnly > 0 && (
                      <span className="text-amber-400/80">{s.rulesOnly} rule-sorted</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Radio className="h-2.5 w-2.5" /> {s.events} classes
                    </span>
                    <span className="flex items-center gap-1">
                      <Link2 className="h-2.5 w-2.5" /> {s.links} links
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function fmtAgo(unixMs: number): string {
  const mins = Math.round((Date.now() - unixMs) / 60000);
  if (mins < 1) return 'just read';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
