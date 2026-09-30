import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Keeps one broken screen from taking the whole app with it.
 *
 * A view that throws during render leaves a blank window: no message, no way
 * back, and nothing in the interface to explain it. This catches it, says what
 * happened, and offers the two things that actually help — try again, or go
 * somewhere else.
 *
 * The screen name is in the message on purpose. A failure in the booster grid is
 * a different problem from one in the planner, and "something went wrong" is not
 * a bug report.
 */
export class ViewBoundary extends Component<
  { children: ReactNode; screen: string; onLeave?: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.screen}] crashed`, error, info.componentStack);
  }

  componentDidUpdate(prev: { screen: string }) {
    // Moving to another screen clears the error, so one broken view does not
    // poison the rest of the session.
    if (prev.screen !== this.props.screen && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    const { children, screen, onLeave } = this.props;

    if (!error) return children;

    return (
      <div className="min-h-[60vh] grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-11 h-11 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/25 grid place-items-center">
            <span className="text-rose-300 text-lg leading-none">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">
              The {screen} screen hit a problem
            </p>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Everything else still works. This is a bug worth reporting with the message below.
            </p>
          </div>
          <p className="text-[11px] font-mono text-slate-600 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-left break-words">
            {error.message}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-medium
                         border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
            >
              Try again
            </button>
            {onLeave && (
              <button
                onClick={onLeave}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-medium
                           border border-white/10 hover:bg-white/10 transition-colors"
              >
                Go to Today
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
