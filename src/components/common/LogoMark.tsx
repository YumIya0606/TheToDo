import { cn } from '@/lib/utils';

/**
 * TheToDo app mark — a rounded-square "tick + spark" monogram.
 * Designed to stay legible at 24px (sidebar) and 40px (overlay mini shape).
 * The gradient is baked into the SVG so it renders identically anywhere.
 */
export function LogoMark({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('block', className)}
      role="img"
      aria-label="TheToDo"
      style={glow ? { filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.55))' } : undefined}
    >
      <defs>
        <linearGradient id="td-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="55%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill="#0a1426" />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="17.25" fill="none" stroke="url(#td-grad)" strokeWidth="1.6" opacity="0.85" />
      <path
        d="M18 33.5 L28 43.5 L46 22"
        fill="none"
        stroke="url(#td-grad)"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47.5" cy="18.5" r="4" fill="#67e8f9" />
    </svg>
  );
}
