import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { credentials } from '@/lib/engine';

/**
 * Telegram API credentials.
 *
 * Three of your channels publish no web preview, so reading them needs an api_id
 * and api_hash. They can go in the app or in the .env file; the file wins if
 * both are set, which is what someone who configured it on disk expects. Either
 * way a change needs a restart, because the reading engine is a separate process
 * that reads them once at launch.
 */
export function TelegramCredentials({ onChanged }: { onChanged: () => void }) {
  const [info, setInfo] = useState<{
    configured: boolean;
    source: string;
    apiId: string;
    apiHash: string;
    envPath: string;
  } | null>(null);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    credentials.info().then(setInfo).catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await credentials.save(apiId, apiHash);
      setMsg(r.note);
      setApiId('');
      setApiHash('');
      setInfo(await credentials.info());
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSave =
    apiId.trim().length >= 3 || apiHash.trim().length >= 10;

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-slate-500 leading-relaxed">
        Needed only for the three channels with no public web preview, and for downloading the
        papers teachers attach. Get them once from{' '}
        <span className="text-cyan-300">my.telegram.org → API development tools</span>; any app name
        works.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <span
            className={`chip ring-1 ${
              info?.configured
                ? 'bg-emerald-500/14 text-emerald-200 ring-emerald-500/25'
                : 'bg-amber-500/14 text-amber-200 ring-amber-500/25'
            }`}
          >
            {info?.configured
              ? `set · from ${info.source === 'environment' ? 'the .env file' : 'this app'}`
              : 'not set'}
          </span>
          {info?.configured && (
            <p className="text-[10.5px] text-slate-500 font-mono mt-1 truncate">
              api_id {info.apiId} · api_hash {info.apiHash}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field font-mono !text-[12px] !w-[150px]"
          placeholder="api_id"
          value={apiId}
          onChange={(e) => setApiId(e.target.value)}
          aria-label="Telegram api_id"
        />
        <input
          className="field font-mono !text-[12px] flex-1 min-w-[220px]"
          placeholder="api_hash"
          value={apiHash}
          onChange={(e) => setApiHash(e.target.value)}
          aria-label="Telegram api_hash"
        />
        <button
          onClick={save}
          disabled={busy || !canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300
                     text-xs font-medium border border-cyan-500/30 hover:bg-cyan-500/25
                     transition-colors disabled:opacity-40"
        >
          {busy ? (
            'Saving…'
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> Save
            </>
          )}
        </button>
      </div>

      {msg && <p className="text-[11px] text-brand-200">{msg}</p>}

      <p className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
        <KeyRound className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Or put <code className="text-slate-400">TG_API_ID</code> and{' '}
          <code className="text-slate-400">TG_API_HASH</code> in{' '}
          <code className="text-slate-400">{info?.envPath ?? '.env'}</code> and restart. The file
          wins if both are set.
        </span>
      </p>
    </div>
  );
}
