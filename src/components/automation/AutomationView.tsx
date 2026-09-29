import { useState } from 'react';
import { Terminal, Plus, Trash2, Zap, Pencil, Loader2, Play } from 'lucide-react';
import { useAutomationStore } from '@/stores/automationStore';
import { useUIStore } from '@/stores/uiStore';
import { PageHeader } from '@/components/common/PageHeader';
import { showInAppToast } from '@/components/common/InAppToast';
import { motion, AnimatePresence } from 'framer-motion';

export function AutomationView() {
  const { jobs, deleteJob, runJob } = useAutomationStore();
  const { openAutomationModal } = useUIStore();
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (id: string) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return;

    setRunningId(id);
    try {
      const ok = await runJob(id);
      if (ok) {
        showInAppToast(`🚀 Launched: ${job.title}`);
      } else {
        showInAppToast(`⚠️ Failed to launch: ${job.title}`);
      }
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Automation Hub" 
        subtitle="Manage and launch your local scripts and snippet workflows" 
      />

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <span className="text-sm text-slate-400 self-center">{jobs.length} Jobs Configured</span>
        </div>
        {/* Direct Trigger for Automation Modal */}
        <button
          onClick={() => openAutomationModal()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          New Job
        </button>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
            <Terminal className="h-16 w-16 text-slate-700 mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Automations Yet</h3>
            <p className="text-slate-500 max-w-md text-center mb-6">
              Create your first script runner to execute Python, FFmpeg, or batch commands directly from TheToDo.
            </p>
            <button
              onClick={() => openAutomationModal()}
              className="px-6 py-3 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 transition-colors font-medium"
            >
              Create Job
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-[#0f2442]/60 backdrop-blur-md border border-cyan-900/30 rounded-2xl p-6 hover:border-cyan-500/50 hover:shadow-[0_0_30px_-10px_rgba(6,182,212,0.3)] transition-all duration-300 overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openAutomationModal(job.id)}
                    title="Edit job"
                    className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteJob(job.id)}
                    title="Delete job"
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30">
                    <Zap className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{job.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                        {job.executor}
                      </span>
                      <span className="text-xs text-slate-500 truncate max-w-[150px]">{job.scriptPath}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#060f1c]/80 rounded-lg p-3 mb-6 border border-slate-800/50">
                  <code className="text-xs font-mono text-cyan-300/80 block truncate">
                    {job.command} {job.args}
                  </code>
                </div>

                <button
                  onClick={() => handleRun(job.id)}
                  disabled={runningId !== null}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold shadow-lg shadow-cyan-900/20 transition-all transform active:scale-95 flex items-center justify-center gap-2"
                >
                  {runningId === job.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {runningId === job.id ? 'Launching…' : 'Launch 🚀'}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
