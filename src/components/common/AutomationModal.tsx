import { useState, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAutomationStore } from '@/stores/automationStore';
import { UnifiedModal } from './UnifiedModal';
import { open } from '@tauri-apps/plugin-dialog';

export function AutomationModal() {
  const { isAutomationModalOpen, closeAutomationModal, editingAutomationId } = useUIStore();
  const { addJob, updateJob, jobs } = useAutomationStore();

  const editingJob = editingAutomationId ? jobs.find((j) => j.id === editingAutomationId) : null;

  const [formData, setFormData] = useState({
    title: '',
    executor: 'cmd' as 'cmd' | 'powershell',
    scriptPath: '',
    command: '',
    args: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-populate when editing
  useEffect(() => {
    if (isAutomationModalOpen && editingJob) {
      setFormData({
        title: editingJob.title,
        executor: editingJob.executor,
        scriptPath: editingJob.scriptPath,
        command: editingJob.command,
        args: editingJob.args ?? '',
      });
    } else if (isAutomationModalOpen) {
      setFormData({ title: '', executor: 'cmd', scriptPath: '', command: '', args: '' });
    }
  }, [isAutomationModalOpen, editingAutomationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBrowsePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Script or Project Folder"
      });
      if (selected && typeof selected === 'string') {
        setFormData(prev => ({ ...prev, scriptPath: selected }));
      }
    } catch (err) {
      console.error("Failed to open directory picker:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingJob) {
        updateJob(editingJob.id, {
          title: formData.title,
          executor: formData.executor,
          scriptPath: formData.scriptPath,
          command: formData.command,
          args: formData.args,
        });
      } else {
        addJob({
          title: formData.title,
          executor: formData.executor,
          scriptPath: formData.scriptPath,
          command: formData.command,
          args: formData.args
        });
      }
    } finally {
      setIsSubmitting(false);
      closeAutomationModal();
      setFormData({ title: '', executor: 'cmd', scriptPath: '', command: '', args: '' });
    }
  };

  return (
    <UnifiedModal
      isOpen={isAutomationModalOpen}
      onClose={closeAutomationModal}
      title={editingJob ? 'Edit Automation Job' : 'Create Automation Job'}
      onSubmit={handleSubmit}
      submitLabel={editingJob ? 'Save Changes' : 'Create Job'}
      isSubmitting={isSubmitting}
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Job Title</label>
          <input
            required
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            placeholder="e.g., Daily Backup Script"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Executor</label>
            <select
              value={formData.executor}
              onChange={e => setFormData({ ...formData, executor: e.target.value as any })}
              className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            >
              <option value="cmd">Command Prompt</option>
              <option value="powershell">PowerShell</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Script Path</label>
            <div className="flex gap-2">
              <input
                required
                value={formData.scriptPath}
                onChange={e => setFormData({ ...formData, scriptPath: e.target.value })}
                className="flex-1 rounded-lg border border-cyan-900/50 bg-[#060f1c] p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                placeholder="C:\Scripts"
              />
              <button
                type="button"
                onClick={handleBrowsePath}
                className="p-2.5 rounded-lg bg-cyan-900/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Command</label>
          <textarea
            required
            value={formData.command}
            onChange={e => setFormData({ ...formData, command: e.target.value })}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none min-h-[100px] font-mono"
            placeholder="python main.py --run"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Arguments (Optional)</label>
          <input
            value={formData.args}
            onChange={e => setFormData({ ...formData, args: e.target.value })}
            className="w-full rounded-lg border border-cyan-900/50 bg-[#060f1c] p-3 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
            placeholder="--verbose --output ./logs"
          />
        </div>
      </div>
    </UnifiedModal>
  );
}
