import { useState } from 'react';
import { Download, Upload, FileJson, CheckCircle, AlertCircle } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { Card, Button } from '../ui/Button';
import { cn } from '@/lib/utils';

export function ImportExportView() {
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const { entries } = useDiaryStore();
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const handleExport = () => {
    const data = {
      tasks,
      notes,
      diaryEntries: entries,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thetodo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus({ type: 'success', message: 'Data exported successfully!' });
    setTimeout(() => setStatus({ type: null, message: '' }), 3000);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // Here you would typically call store actions to import data
        // For now, we just show success
        if (data.tasks && data.notes) {
          setStatus({ type: 'success', message: 'Data imported successfully! (Mock implementation)' });
        } else {
          throw new Error('Invalid file format');
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Failed to import: Invalid file format' });
      }
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Import & Export</h2>
        <p className="text-slate-400">Backup and restore your data</p>
      </div>

      {status.type && (
        <div className={cn(
          "p-4 rounded-lg flex items-center gap-3",
          status.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {status.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {status.message}
        </div>
      )}

      <Card className="p-8 text-center border-dashed hover:border-emerald-500/50 transition-colors">
        <FileJson className="h-16 w-16 mx-auto text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Export All Data</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Download a complete backup of your tasks, notes, and diary entries in JSON format.
        </p>
        <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Download className="h-4 w-4" />
          Export Backup
        </Button>
      </Card>

      <Card className="p-8 text-center border-dashed hover:border-indigo-500/50 transition-colors">
        <Upload className="h-16 w-16 mx-auto text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Import Data</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Restore your data from a previous backup file. This will merge with existing data.
        </p>
        <label className="inline-block">
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer transition-colors">
            <Upload className="h-4 w-4" />
            Select File
          </span>
        </label>
      </Card>

      <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
        <h4 className="font-medium text-white mb-2">Statistics</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-400">{tasks.length}</div>
            <div className="text-xs text-slate-500">Tasks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-400">{notes.length}</div>
            <div className="text-xs text-slate-500">Notes</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{entries.length}</div>
            <div className="text-xs text-slate-500">Diary Entries</div>
          </div>
        </div>
      </div>
    </div>
  );
}