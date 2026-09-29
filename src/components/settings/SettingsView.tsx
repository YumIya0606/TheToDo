import { useEffect, useState } from 'react';
import { Moon, Sun, Bell, Info, Download, Upload, CheckCircle2, AlertCircle, ShieldCheck, FolderOpen, Radio } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { collectBackupData, saveBackupToDisk, restoreBackupData } from '@/lib/backup';
import { defaultSchedulePath, loadSchedule } from '@/lib/classRadar';
import { toStudyPointer } from '@/lib/classRadar';
import { useBoosterStore } from '@/stores/boosterStore';
import { emit } from '@tauri-apps/api/event';

export function SettingsView() {
  const { theme, toggleTheme } = useUIStore();
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const { entries } = useDiaryStore();
  const { isAutoBackupEnabled, toggleAutoBackup, autoBackupPath, setAutoBackupPath } = useSettingsStore();
  const { classRadarPath, setClassRadarPath, classRadarCheckedAt } = useSettingsStore();

  const [radarState, setRadarState] = useState<'no data' | 'loading' | 'ok'>('no data');
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarCounts, setRadarCounts] = useState<Record<string, number> | null>(null);
  const [radarPath, setRadarPath] = useState('');
  const [radarDefault, setRadarDefault] = useState('');
  const [manualRadarPath, setManualRadarPath] = useState('');

  useEffect(() => {
    let alive = true;
    void defaultSchedulePath().then((p) => {
      if (alive) {
        setRadarDefault(p);
        setRadarPath(classRadarPath ?? p);
        setManualRadarPath(classRadarPath ?? '');
      }
    });
    return () => {
      alive = false;
    };
  }, [classRadarPath]);

  const refreshRadar = async () => {
    setRadarState('loading');
    setRadarError(null);
    const r = await loadSchedule(true);
    if (r.ok && r.data) {
      setRadarState('ok');
      setRadarCounts(r.data.counts as unknown as Record<string, number>);
      setRadarPath(r.path);
      // Keep the booster pointer fresh from here too, so the study banner is
      // right even when Classes has not been opened.
      const next = toStudyPointer(r.data.boosterPlan);
      if (next) {
        useBoosterStore.getState().setPointer(next);
        void emit('booster-pointer', next);
      }
    } else {
      setRadarState('no data');
      setRadarError(r.error);
    }
  };

  const applyRadarPath = () => {
    const trimmed = manualRadarPath.trim();
    setClassRadarPath(trimmed || null);
    setRadarPath(trimmed || radarDefault);
    void refreshRadar();
  };

  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualPath, setShowManualPath] = useState(false);
  const [manualPathInput, setManualPathInput] = useState('');

  const flash = (type: 'success' | 'error', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus({ type: null, message: '' }), 4000);
  };

  const requestPermissionAndNotify = async () => {
    try {
      await sendNotification({ title: 'TheToDo System', body: 'Desktop notifications are now active!', icon: 'icon.png', sound: 'Default' });
      flash('success', 'System notifications enabled successfully.');
    } catch (e) {
      console.error(e);
      flash('error', 'Failed to initialize system notifications.');
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const jsonString = JSON.stringify(collectBackupData(), null, 2);
      const method = await saveBackupToDisk(jsonString);

      if (method === 'cancelled') {
        return;
      }

      try {
        sendNotification({
          title: 'Backup Successful',
          body: method === 'tauri' ? 'Data saved to selected location.' : 'Backup downloaded to your Downloads folder.',
          icon: 'icon.png',
          sound: 'Default',
        });
      } catch { /* non-fatal */ }

      flash(
        'success',
        method === 'tauri' ? 'Backup saved successfully!' : 'Native dialog unavailable — backup downloaded to Downloads.'
      );
    } catch (error) {
      console.error(error);
      flash('error', 'Export failed: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const data = JSON.parse(content);
      if (data && (data.tasks || data.notes || data.diary || data.automation || data.settings)) {
        restoreBackupData(data);
      try {
        sendNotification({ title: 'Import Successful', body: 'Your data has been restored.', icon: 'icon.png', sound: 'Default' });
      } catch { /* non-fatal */ }
        flash('success', 'Data imported! Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error('Invalid backup file format');
      }
    } catch (err) {
      console.error(err);
      flash('error', 'Invalid backup file or read error.');
    } finally {
      setIsProcessing(false);
      event.target.value = '';
    }
  };

  const handleSelectAutoBackupPath = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Select Default Auto-Backup Folder' });
      if (selected && typeof selected === 'string') {
        setAutoBackupPath(selected);
        flash('success', 'Auto-backup path set successfully.');
      }
    } catch {
      setManualPathInput(autoBackupPath ?? '');
      setShowManualPath(true);
      flash('error', 'Folder picker unavailable — enter a path manually below.');
    }
  };

  const handleManualPathSave = () => {
    const trimmed = manualPathInput.trim();
    if (!trimmed) {
      flash('error', 'Please enter a valid directory path.');
      return;
    }
    setAutoBackupPath(trimmed);
    setShowManualPath(false);
    flash('success', 'Auto-backup path set successfully.');
  };

  const card = 'bg-[#060f1c]/50 border border-slate-800 rounded-2xl p-6';
  const row = 'flex items-center justify-between py-3';
  const label = 'text-sm font-medium text-slate-200';
  const desc = 'text-xs text-slate-500';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-xs text-slate-500 mt-1">Configure your workspace</p>
      </div>

      {status.type && (
        <div
          className={cn(
            'px-4 py-2.5 rounded-xl flex items-center gap-2.5 text-sm border animate-in slide-in-from-top-2',
            status.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          )}
        >
          {status.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {status.message}
        </div>
      )}

      {/* General */}
      <section className={card}>
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-1">
          <Moon className="h-4 w-4 text-cyan-400" /> General
        </h3>
        <div className={row}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400')}>
              {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
            <div>
              <p className={label}>Theme</p>
              <p className={desc}>Current: {theme === 'dark' ? 'Deep Ocean' : 'Azure Light'}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              theme === 'dark' ? 'bg-cyan-600' : 'bg-slate-600'
            )}
          >
            <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', theme === 'dark' ? 'translate-x-6' : 'translate-x-1')} />
          </button>
        </div>
      </section>

      {/* ClassRadar */}
      <section className={card}>
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-1">
          <Radio className="h-4 w-4 text-cyan-400" /> ClassRadar
        </h3>
        <p className={cn(desc, 'mb-4')}>
          Reads your tuition channels and brings the schedule in here. It is a separate app; this
          only points at the file it exports.
        </p>

        <div className="space-y-2">
          <div className={row}>
            <div className="min-w-0">
              <p className={label}>Schedule file</p>
              <p className={cn(desc, 'font-mono text-[10px] truncate')}>
                {radarPath || 'not set — the default location is used'}
              </p>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium border shrink-0',
                radarState === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                  : radarState === 'loading'
                    ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
              )}
            >
              {radarState === 'ok' ? 'connected' : radarState === 'loading' ? 'reading…' : 'no data'}
            </span>
          </div>

          {radarCounts && (
            <p className="text-[11px] text-slate-500">
              {radarCounts.events} classes, {radarCounts.boosterPosts} study-plan posts,{' '}
              {radarCounts.understood} of {radarCounts.messages} messages understood
              {classRadarCheckedAt
                ? ` · checked ${new Date(classRadarCheckedAt).toLocaleString('en-GB')}`
                : ''}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={refreshRadar}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 text-xs font-medium
                         border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors"
            >
              {radarState === 'loading' ? 'Reading…' : 'Read now'}
            </button>
            <input
              value={manualRadarPath}
              onChange={(e) => setManualRadarPath(e.target.value)}
              placeholder={radarDefault || 'C:\\Users\\...\\ClassRadar\\data\\schedule.json'}
              className="flex-1 min-w-[220px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5
                         text-[11px] font-mono text-slate-300 outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={applyRadarPath}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-medium
                         border border-white/10 hover:bg-white/10 transition-colors"
            >
              Use this path
            </button>
            {classRadarPath && (
              <button
                onClick={() => {
                  setClassRadarPath(null);
                  setManualRadarPath('');
                  void refreshRadar();
                }}
                className="px-2 py-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {radarError && (
            <p className="text-[11px] text-amber-300/80">
              {radarError} Open ClassRadar and press Export schedule, then Read now.
            </p>
          )}
        </div>
      </section>

      {/* Data & Backup */}
      <section className={card}>
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-blue-400" /> Data &amp; Backup
        </h3>
        <p className={cn(desc, 'mb-4')}>{tasks.length + notes.length + entries.length} items tracked</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="p-4 rounded-xl bg-black/20 border border-slate-800/80 flex flex-col gap-3">
            <div>
              <p className={label}>Export Backup</p>
              <p className={desc}>Save tasks, notes &amp; diary as JSON (native save dialog with browser fallback).</p>
            </div>
            <Button
              onClick={handleExport}
              disabled={isProcessing}
              className="h-9 px-4 text-sm gap-2 self-start bg-cyan-600 hover:bg-cyan-500"
            >
              <Download className="h-3.5 w-3.5" />
              {isProcessing ? 'Saving…' : 'Export'}
            </Button>
          </div>
          <div className="p-4 rounded-xl bg-black/20 border border-slate-800/80 flex flex-col gap-3">
            <div>
              <p className={label}>Restore Data</p>
              <p className={desc}>Load a previous backup file.</p>
            </div>
            <label className="self-start cursor-pointer">
              <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isProcessing} />
              <span className="inline-flex items-center gap-2 h-9 px-4 text-sm rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-all">
                <Upload className="h-3.5 w-3.5" />
                {isProcessing ? 'Loading…' : 'Select File'}
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className={row}>
            <div>
              <p className={label}>Auto-Backup on Exit</p>
              <p className={desc}>Automatically save a backup when the app closes.</p>
            </div>
            <button
              onClick={toggleAutoBackup}
              className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', isAutoBackupEnabled ? 'bg-emerald-600' : 'bg-slate-700')}
            >
              <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', isAutoBackupEnabled ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>

          {isAutoBackupEnabled && (
            <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={autoBackupPath || 'No path selected'}
                  className="flex-1 rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-xs text-slate-500 outline-none"
                />
                <Button onClick={handleSelectAutoBackupPath} variant="outline" className="h-9 px-4 text-sm border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300">
                  <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Browse
                </Button>
              </div>
              {showManualPath && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                  <input
                    type="text"
                    value={manualPathInput}
                    onChange={(e) => setManualPathInput(e.target.value)}
                    placeholder="e.g. D:\Backups\TheToDo or /home/user/backups"
                    className="flex-1 rounded-lg border border-slate-800 bg-black/30 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500/50"
                  />
                  <Button onClick={handleManualPathSave} className="h-9 px-4 text-sm bg-cyan-600 hover:bg-cyan-500 text-white">
                    Save Path
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Notifications */}
      <section className={card}>
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-1">
          <Bell className="h-4 w-4 text-purple-400" /> Notifications
        </h3>
        <div className={row}>
          <div>
            <p className={label}>Desktop Alerts</p>
            <p className={desc}>Receive OS notifications for scheduled tasks and backups.</p>
          </div>
          <Button onClick={requestPermissionAndNotify} variant="outline" className="h-9 px-4 text-sm border-slate-700 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300">
            Enable
          </Button>
        </div>
      </section>

      {/* About */}
      <section className={card}>
        <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-slate-500" /> About
        </h3>
        <p className={desc}>Version 2.0.0 · Tauri v2 + React 19</p>
      </section>
    </div>
  );
}
