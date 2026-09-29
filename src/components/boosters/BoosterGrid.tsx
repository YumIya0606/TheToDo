import { memo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoosterEpisode } from '@/stores/boosterStore';
import { DurationPicker } from './DurationPicker';

interface ChipProps {
  num: number;
  minutes: number;
  watched: boolean;
  missed: boolean;
  selected: boolean;
  light: boolean;
  size: 'sm' | 'md';
  onSelect: (num: number) => void;
}

function durationLabel(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${m}` : `${h}h`;
  }
  return `${minutes}m`;
}

/** One episode tile. Memoized — with 300+ on screen, only the changed one re-renders. */
const Chip = memo(function Chip({ num, minutes, watched, missed, selected, light, size, onSelect }: ChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(num)}
      title={`Episode ${num} · ${durationLabel(minutes)}${watched ? ' · watched' : ' · not watched'} · click to edit`}
      // Off-screen tiles skip rendering entirely — keeps 300+ episodes smooth.
      style={{ contentVisibility: 'auto', containIntrinsicSize: size === 'sm' ? '28px 34px' : '44px 40px' }}
      className={cn(
        'shrink-0 rounded-lg font-semibold tabular-nums transition-colors duration-150 select-none flex flex-col items-center justify-center leading-none',
        size === 'sm' ? 'h-7 w-[34px] text-[10px]' : 'h-11 w-10 text-xs',
        selected
          ? light
            ? 'ring-2 ring-cyan-500 ring-offset-1 ring-offset-white'
            : 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#0a1120]'
          : '',
        watched
          ? light
            ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
          : missed
            ? light
              ? 'bg-amber-50 text-amber-600 border border-amber-300'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/35'
            : light
              ? 'bg-slate-100/70 text-slate-400 border border-slate-200 hover:border-cyan-400 hover:text-cyan-600'
              : 'bg-white/[0.03] text-slate-500 border border-white/[0.07] hover:border-cyan-500/40 hover:text-cyan-300'
      )}
    >
      {num}
      {size === 'md' && (
        <span className="text-[8px] font-medium opacity-60 mt-0.5">{durationLabel(minutes)}</span>
      )}
    </button>
  );
});

/** The "+" tile — sits right after the last episode, expands into a length picker. */
function AddTile({
  light,
  size,
  onAdd,
}: {
  light: boolean;
  size: 'sm' | 'md';
  onAdd: (minutes: number) => void;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="w-full max-w-[236px]">
        <DurationPicker
          light={light}
          onPick={(minutes) => { onAdd(minutes); setOpen(false); }}
          onCancel={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Add a new episode"
      className={cn(
        'shrink-0 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors',
        size === 'sm' ? 'h-7 w-[34px]' : 'h-11 w-10',
        light
          ? 'border-slate-300 text-slate-400 hover:border-cyan-400 hover:text-cyan-600'
          : 'border-white/15 text-slate-500 hover:border-cyan-500/50 hover:text-cyan-300'
      )}
    >
      <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  );
}

interface GridProps {
  episodes: BoosterEpisode[];
  /** Highest watched number; episodes below it that aren't watched are "missed". */
  highest: number;
  light: boolean;
  size?: 'sm' | 'md';
  /** Currently selected episode number, or null. */
  selected?: number | null;
  onSelect: (num: number) => void;
  /** Provide to render the trailing "+ new episode" tile. */
  onAdd?: (minutes: number) => void;
}

export const BoosterGrid = memo(function BoosterGrid({
  episodes, highest, light, size = 'md', selected, onSelect, onAdd,
}: GridProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {episodes.map((e) => (
        <Chip
          key={e.num}
          num={e.num}
          minutes={e.minutes}
          watched={e.watched}
          missed={highest > 0 && !e.watched && e.num < highest}
          selected={selected === e.num}
          light={light}
          size={size}
          onSelect={onSelect}
        />
      ))}
      {onAdd && <AddTile light={light} size={size} onAdd={onAdd} />}
    </div>
  );
});
