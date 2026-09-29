import { motion } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import type { StudyPointer } from '@/stores/boosterStore';
import { cn } from '@/lib/utils';

/**
 * What to work on next, as read from the tuition channel.
 *
 * Rendered beside the episode grid, never inside it. The grid is 460 memoised
 * tiles, and passing this state down as a prop would defeat that memo for every
 * tile on every study-plan change.
 */
export function StudyPointerBanner({
  pointer,
  light,
  onClear,
  onJump,
  className,
}: {
  pointer: StudyPointer | null;
  light?: boolean;
  onClear?: () => void;
  /** Jump to that episode in the grid. */
  onJump?: (num: number) => void;
  className?: string;
}) {
  if (!pointer) return null;

  const range =
    pointer.questionStart != null && pointer.questionEnd != null
      ? pointer.questionStart === pointer.questionEnd
        ? `Q${pointer.questionStart}`
        : `Q${pointer.questionStart}–${pointer.questionEnd}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border px-3 py-2',
        light
          ? 'border-cyan-200 bg-cyan-50/80'
          : 'border-cyan-500/25 bg-cyan-500/[0.07]',
        className
      )}
    >
      <BookOpen
        className={cn('h-4 w-4 shrink-0', light ? 'text-cyan-600' : 'text-cyan-400')}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              'text-[11px] font-semibold',
              light ? 'text-cyan-800' : 'text-cyan-200'
            )}
          >
            Next: {pointer.kind === 'speed' ? 'Speed' : pointer.kind === 'theory' ? 'Theory' : 'Booster'}
            {pointer.episode != null ? ` EP ${pointer.episode}` : ''}
          </span>
          {pointer.tute && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9.5px]',
                light ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/15 text-cyan-300'
              )}
            >
              {pointer.tute}
            </span>
          )}
          {pointer.questionCount != null && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[9.5px]',
                light ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-400'
              )}
            >
              {pointer.questionCount} question{pointer.questionCount === 1 ? '' : 's'}
              {range ? ` (${range})` : ''}
            </span>
          )}
        </div>
        {pointer.headline && (
          <p className={cn('text-[11px] mt-0.5 truncate', light ? 'text-cyan-700/80' : 'text-ink-400')}>
            {pointer.headline}
          </p>
        )}
      </div>

      {onJump && pointer.episode != null && (
        <button
          onClick={() => onJump(pointer.episode!)}
          className={cn(
            'shrink-0 px-2 py-1 rounded text-[10px] font-medium transition-colors',
            light
              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30'
          )}
        >
          Go to episode
        </button>
      )}

      {onClear && (
        <button
          onClick={onClear}
          aria-label="Dismiss"
          className={cn(
            'shrink-0 p-1 rounded transition-colors',
            light ? 'text-cyan-400 hover:text-cyan-700' : 'text-slate-600 hover:text-ink-300'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
