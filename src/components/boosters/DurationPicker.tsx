import { useState } from 'react';
import { X } from 'lucide-react';
import { DURATION_PRESETS } from '@/stores/boosterStore';
import { cn } from '@/lib/utils';

function label(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  return `${m}m`;
}

/**
 * Duration picker — the presets boosters come in, plus a custom one. Nothing is
 * pre-selected: new recordings never default to the current length, you always
 * pick. Renders in-flow (no portal) so it works inside scroll containers.
 */
export function DurationPicker({
  light,
  onPick,
  onCancel,
}: {
  light: boolean;
  onPick: (minutes: number) => void;
  onCancel?: () => void;
}) {
  const [custom, setCustom] = useState('');

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(custom);
    if (Number.isFinite(n) && n > 0) onPick(Math.round(n));
    setCustom('');
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-2 shadow-2xl min-w-[208px] z-50',
        light ? 'bg-white border-slate-200' : 'bg-[#0d1626] border-white/10'
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={cn('text-[10px] font-semibold uppercase tracking-widest', light ? 'text-slate-400' : 'text-slate-500')}>
          Length
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={cn('p-0.5 rounded-md transition-colors', light ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-white')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DURATION_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              light
                ? 'bg-slate-50 text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-600'
                : 'bg-white/[0.04] text-slate-300 border-white/10 hover:border-cyan-500/50 hover:text-cyan-300'
            )}
          >
            {label(m)}
          </button>
        ))}
      </div>
      <form onSubmit={submitCustom} className="mt-2 flex items-center gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          inputMode="numeric"
          placeholder="custom (min)"
          className={cn(
            'w-full rounded-lg px-2.5 py-1 text-xs outline-none border',
            light
              ? 'bg-slate-50 border-slate-200 text-slate-700 focus:border-cyan-400'
              : 'bg-white/[0.04] border-white/10 text-slate-200 focus:border-cyan-500/50'
          )}
        />
        <button
          type="submit"
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
        >
          Add
        </button>
      </form>
    </div>
  );
}
