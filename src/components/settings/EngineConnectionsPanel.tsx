import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { engine, engineAlive, bundlePathFrom, defaultSchedulePath, launchEngine, type EngineConnection } from '@/lib/engine';
import { cn } from '@/lib/utils';

const KEY_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'working', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25' },
  rate_limited: { label: 'rate limited', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/25' },
  invalid: { label: 'rejected', cls: 'bg-rose-500/15 text-rose-300 ring-rose-500/25' },
  unknown: { label: 'untested', cls: 'bg-slate-500/15 text-slate-400 ring-slate-500/20' },
};

/**
 * API keys, endpoints and model choice, all in the app that uses them.
 *
 * Free tiers cap requests per key, so more than one key per connection is the
 * single most effective thing a student can do. Each key's health is tracked and
 * the engine routes around whatever is throttled, so the panel's job is to make
 * that visible and one tap to add.
 */
export function EngineConnectionsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [alive, setAlive] = useState<boolean | null>(null);
  const [list, setList] = useState<EngineConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [schedulePath, setSchedulePath] = useState('');

  // Add-key form, per connection
  const [newKey, setNewKey] = useState<Record<string, string>>({});
  // Add-endpoint form
  const [showAdd, setShowAdd] = useState(false);
  const [cName, setCName] = useState('');
  const [cUrl, setCUrl] = useState('');
  const [cKey, setCKey] = useState('');

  const load = useCallback(async () => {
    if (!(await engineAlive())) {
      setAlive(false);
      setList(null);
      // Learn where the engine would keep its data even while it is down, so
      // the start button knows what to launch.
      try {
        setSchedulePath(await defaultSchedulePath());
      } catch {
        setSchedulePath('');
      }
      return;
    }
    try {
      const [s, conns] = await Promise.all([engine.state(), engine.connections()]);
      setList(conns as unknown as EngineConnection[]);
      setAlive(true);
      setError(s.advice ? s.advice.headline : null);
    } catch (e) {
      setAlive(false);
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Start the engine rather than telling the student to go and start another
   * app. A frameless Tauri sidecar is not built yet, so this launches the Node
   * bundle the engine already ships.
   */
  const startIt = async () => {
    setStarting(true);
    setMsg(null);
    try {
      const path = schedulePath || (await defaultSchedulePath());
      const bundle = bundlePathFrom(path);
      const dataDir = path.replace(/[\\/]schedule\.json$/i, '');
      await launchEngine(bundle, 5188, dataDir);
      await load();
      onRefresh();
      setMsg({ tone: 'ok', text: 'The reading engine is running.' });
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    } finally {
      setStarting(false);
    }
  };

  const run = async (id: string, fn: () => Promise<unknown>, okText?: string) => {
    setBusy(id);
    setMsg(null);
    try {
      const r = (await fn()) as { suggestedModel?: string | null } | undefined;
      await load();
      onRefresh();
      setMsg(
        {
          tone: 'ok',
          text:
            okText ??
            (r?.suggestedModel
              ? `Done. Switched to ${r.suggestedModel}, the best free model for Sinhala.`
              : 'Done.'),
        },
      );
    } catch (e) {
      setMsg({ tone: 'bad', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const active = useMemo(() => list?.find((c) => c.active) ?? null, [list]);
  const readyKeys = useMemo(
    () => (list ?? []).reduce((n, c) => n + c.keySummary.available, 0),
    [list]
  );

  if (alive === false) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-px" />
          <div className="text-[12px] text-amber-200/90 min-w-0 flex-1">
            <p className="font-semibold">The reading engine is not running</p>
            <p className="mt-0.5 text-amber-200/70 leading-relaxed">
              Your tuition channels are read by a separate engine. Start it here and this section
              fills in with your connections and keys.
            </p>
            {schedulePath && (
              <p className="mt-1.5 text-[10px] text-amber-200/50 font-mono truncate">
                {schedulePath}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={startIt}
            disabled={starting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-100
                       text-xs font-semibold border border-amber-500/30 hover:bg-amber-500/30
                       transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', starting && 'animate-spin')} />
            {starting ? 'Starting…' : 'Start the engine'}
          </button>
          <button
            onClick={() => void load()}
            className="text-[11px] text-amber-200/60 hover:text-amber-100 transition-colors"
          >
            Check again
          </button>
        </div>
        {msg?.tone === 'bad' && (
          <p className="text-[11px] text-rose-300/90 leading-relaxed">{msg.text}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-slate-400">
            Using <span className="text-cyan-300 font-medium">{active?.name ?? 'nothing yet'}</span>
            {active?.model && <span className="font-mono text-slate-500"> · {active.model}</span>}
          </p>
          <p className="text-[10.5px] text-slate-600">
            {readyKeys} key{readyKeys === 1 ? '' : 's'} ready across{' '}
            {(list ?? []).filter((c) => c.keySummary.total > 0).length} connection
            {(list ?? []).filter((c) => c.keySummary.total > 0).length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => void run('reload', async () => {
            await load();
            return null;
          })}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 text-[11px]
                     font-medium border border-white/10 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', busy === 'reload' && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-amber-300/80 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {error}
        </p>
      )}
      {msg && (
        <p
          className={cn(
            'text-[11.5px] px-2.5 py-1.5 rounded-lg border',
            msg.tone === 'ok'
              ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-200 border-rose-500/20'
          )}
        >
          {msg.text}
        </p>
      )}

      <div className="space-y-1.5">
        {(list ?? []).map((c) => {
          const expanded = open === c.id;
          return (
            <div
              key={c.id}
              className={cn(
                'rounded-xl border overflow-hidden transition-colors',
                c.active
                  ? 'border-cyan-500/30 bg-cyan-500/[0.05]'
                  : 'border-white/10 bg-white/[0.02]'
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => setOpen(expanded ? null : c.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12.5px] font-medium text-white">{c.name}</span>
                    {c.active && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300">
                        in use
                      </span>
                    )}
                    {c.kind === 'custom' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400">
                        custom
                      </span>
                    )}
                    {!c.requiresKey && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-300">
                        no key needed
                      </span>
                    )}
                    {c.requiresKey && c.keySummary.total === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-300">
                        needs a key
                      </span>
                    )}
                    {c.keySummary.total > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-400">
                        {c.keySummary.available}/{c.keySummary.total} keys
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">
                    {c.model || 'no model chosen'}
                  </p>
                </button>

                {!c.active && (
                  <button
                    onClick={() => void run(c.id, () => engine.use(c.id))}
                    disabled={busy === c.id}
                    className="px-2 py-1 rounded text-[10.5px] font-medium bg-cyan-500/20 text-cyan-300
                               border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                  >
                    Use
                  </button>
                )}
                <button
                  onClick={() => setOpen(expanded ? null : c.id)}
                  className="p-1 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  <Chevron className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
                </button>
              </div>

              {expanded && (
                <div className="border-t border-white/10 px-3 py-2.5 space-y-2.5">
                  {/* keys */}
                  {c.keys.length > 0 && (
                    <div className="space-y-1">
                      {c.keys.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/8"
                        >
                          <KeyRound className="h-3 w-3 text-slate-600 shrink-0" />
                          <span className="text-[11px] text-slate-200">{k.label}</span>
                          <span className="font-mono text-[10px] text-slate-500">{k.masked}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] ring-1',
                              KEY_STATUS[k.status]?.cls
                            )}
                          >
                            {KEY_STATUS[k.status]?.label}
                          </span>
                          {k.coolingDown && (
                            <span className="text-[9px] text-amber-300/80">cooling down</span>
                          )}
                          <span className="text-[9.5px] text-slate-600 ml-auto tabular-nums">
                            {k.used} used · {k.ok} ok
                          </span>
                          <button
                            onClick={() => void run(c.id, () => engine.removeKey(k.id))}
                            className="p-0.5 text-slate-600 hover:text-rose-400 transition-colors"
                            aria-label="Remove key"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <input
                      value={newKey[c.id] ?? ''}
                      onChange={(e) => setNewKey((n) => ({ ...n, [c.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (newKey[c.id] ?? '').trim().length > 8) {
                          void run(c.id, () =>
                            engine.addKey(c.id, (newKey[c.id] ?? '').trim(), '')
                          ).then(() => setNewKey((n) => ({ ...n, [c.id]: '' })));
                        }
                      }}
                      placeholder="Paste another key…"
                      className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-md px-2 py-1
                                 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
                    />
                    <SmallBtn
                      onClick={() =>
                        void run(c.id, () =>
                          engine.addKey(c.id, (newKey[c.id] ?? '').trim(), '')
                        ).then(() => setNewKey((n) => ({ ...n, [c.id]: '' })))
                      }
                      disabled={busy === c.id || (newKey[c.id] ?? '').trim().length < 8}
                    >
                      <Plus className="h-3 w-3" /> Add key
                    </SmallBtn>
                    <SmallBtn
                      onClick={() => void run(c.id, () => engine.testKeys())}
                      disabled={busy === c.id}
                    >
                      <Cpu className="h-3 w-3" /> Test keys
                    </SmallBtn>
                    <SmallBtn
                      onClick={() =>
                        void run(
                          c.id,
                          () => engine.tryConnection(c.id),
                          'That connection answered.'
                        )
                      }
                      disabled={busy === c.id}
                    >
                      <CheckCircle2 className="h-3 w-3" /> Try it
                    </SmallBtn>
                    {c.keySummary.rateLimited > 0 && (
                      <SmallBtn
                        onClick={() => void run(c.id, () => engine.revive(c.id), 'Cooldowns cleared.')}
                        disabled={busy === c.id}
                      >
                        Clear cooldowns
                      </SmallBtn>
                    )}
                    {c.removable && (
                      <SmallBtn
                        danger
                        onClick={() => void run(c.id, () => engine.removeConnection(c.id), 'Removed.')}
                        disabled={busy === c.id}
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </SmallBtn>
                    )}
                  </div>

                  {/* models */}
                  {c.models.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Model · {c.models.filter((m) => m.free === true || m.isFree).length} free
                      </p>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10">
                        {c.models.slice(0, 60).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => void run(c.id, () => engine.setModel(c.id, m.id))}
                            className={cn(
                              'w-full text-left px-2 py-1 flex items-center gap-2 border-b border-white/5 last:border-0 transition-colors',
                              c.model === m.id ? 'bg-cyan-500/10' : 'hover:bg-white/5'
                            )}
                          >
                            <span className="font-mono text-[10.5px] text-slate-300 truncate flex-1">
                              {m.id}
                            </span>
                            {(m.free === true || m.isFree) && (
                              <span className="text-[9px] text-emerald-400">free</span>
                            )}
                            {m.why && <span className="text-[9px] text-slate-600">{m.why}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.modelsWarning && (
                    <p className="text-[10.5px] text-amber-300/80">{c.modelsWarning}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* add a custom endpoint */}
      <div className="pt-1">
        {!showAdd ? (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-cyan-300/90
                       hover:text-cyan-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add a connection
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-1.5 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                New OpenAI-compatible connection
              </span>
              <button onClick={() => setShowAdd(false)} className="text-slate-600 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              Ollama, LM Studio, any reseller, a proxy — anything that speaks{' '}
              <span className="font-mono">/v1/chat/completions</span>. Its model list is read and
              ranked for Sinhala automatically.
            </p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="Name (optional)"
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 outline-none focus:border-cyan-500/50"
              />
              <input
                value={cUrl}
                onChange={(e) => setCUrl(e.target.value)}
                placeholder="https://host/v1  or  http://127.0.0.1:11434/v1"
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <input
                value={cKey}
                onChange={(e) => setCKey(e.target.value)}
                placeholder="API key (blank for a local server)"
                className="flex-1 min-w-[180px] bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
              />
              <SmallBtn
                disabled={busy === 'add' || cUrl.trim().length < 4}
                onClick={() =>
                  void run('add', () => engine.addConnection(cName, cUrl.trim(), cKey.trim())).then(() => {
                    setShowAdd(false);
                    setCName('');
                    setCUrl('');
                    setCKey('');
                  })
                }
              >
                <Plus className="h-3 w-3" /> Add connection
              </SmallBtn>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium border transition-colors disabled:opacity-40',
        danger
          ? 'bg-rose-500/10 text-rose-300 border-rose-500/25 hover:bg-rose-500/20'
          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
      )}
    >
      {children}
    </button>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
