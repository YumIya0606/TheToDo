import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * A visible failure instead of a blank window.
 *
 * The Quick Capture overlay is a frameless, always-on-top 44x44 shape with no
 * title bar, so when anything in it throws there is nothing on screen to
 * indicate a problem: the window is simply there, showing nothing. That is
 * exactly the "boosters show nothing" symptom, and it hides the real error.
 * This puts the message where it can be seen, and offers the one action that
 * recovers it.
 */
export class OverlayBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { error: Error | null; info: string }
> {
  state: { error: Error | null; info: string } = { error: null, info: '' };

  static getDerivedStateFromError(error: Error) {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack?.split('\n').slice(0, 3).join(' ') ?? '' });
    // Also to the devtools console, which is where the real trace lives.
    console.error('[quick-capture] crashed', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-full w-full bg-[#0a1120] text-slate-200 p-4 flex items-center justify-center">
        <div className="max-w-[300px] space-y-3 text-left">
          <p className="text-[13px] font-semibold text-rose-300">Quick Capture hit an error</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">{error.message}</p>
          {info && (
            <p className="text-[10px] text-slate-600 font-mono leading-relaxed break-words">
              {info}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => this.setState({ error: null, info: '' })}
              className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-200 text-[11px] font-medium
                         border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
            >
              Try again
            </button>
            <button
              onClick={() => this.props.onReset?.()}
              className="px-2.5 py-1 rounded bg-white/5 text-slate-300 text-[11px] font-medium
                         border border-white/10 hover:bg-white/10 transition-colors"
            >
              Reset overlay
            </button>
          </div>
        </div>
      </div>
    );
  }
}
