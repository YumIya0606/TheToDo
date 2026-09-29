import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3 } from 'lucide-react';
import { useFocusStore } from '@/stores/focusStore';

const SUBJECTS = ['AL Physics', 'AL Chemistry', 'Combined Maths', 'General English'];

function fmt(seconds: number): string {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function lastNDays(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    out.push({ key, label });
  }
  return out;
}

export function AnalyticsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { studyAnalytics } = useFocusStore();
  const days = lastNDays(7);

  // Per-day totals across all subjects
  const dayTotals = days.map(({ key }) =>
    SUBJECTS.reduce((sum, s) => sum + (studyAnalytics[key]?.[s] ?? 0), 0)
  );
  const maxDay = Math.max(1, ...dayTotals);

  // Lifetime per subject (all dates)
  const lifetime = SUBJECTS.map((s) => ({
    name: s,
    seconds: Object.values(studyAnalytics).reduce((sum, day) => sum + (day?.[s] ?? 0), 0),
  }));
  const maxLifetime = Math.max(1, ...lifetime.map((l) => l.seconds));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-[#0a1120]/90 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0a1120]/95 backdrop-blur z-10">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" /> Study Analytics
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* 7-day bar chart — total across subjects */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-4">Last 7 Days — All Subjects</h3>
                <div className="flex items-end gap-3 h-40">
                  {days.map(({ key, label }, i) => {
                    const secs = dayTotals[i];
                    const pct = (secs / maxDay) * 100;
                    return (
                      <div key={key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[10px] text-slate-500 tabular-nums">{secs > 0 ? fmt(secs) : ''}</span>
                        <div className="w-full flex-1 flex items-end bg-white/5 rounded-t-lg overflow-hidden">
                          <div
                            className="w-full bg-gradient-to-t from-[#023e8a] via-[#0077b6] to-cyan-400 rounded-t-lg transition-all duration-700"
                            style={{ height: `${Math.max(secs > 0 ? 4 : 0, pct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-600">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lifetime per subject */}
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-4">Lifetime Hours by Subject</h3>
                <div className="space-y-3">
                  {lifetime.map(({ name, seconds }) => (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{name}</span>
                        <span className="text-slate-500 tabular-nums">{fmt(seconds)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
                          style={{ width: `${(seconds / maxLifetime) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
