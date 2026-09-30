import { useState } from 'react';
import { Download, Upload, FileJson, CheckCircle, AlertCircle } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { Card, Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { collectBackupData, saveBackupToDisk, restoreBackupData } from '@/lib/backup';

export function ImportExportView() {
  const { tasks } = useTaskStore();
  const { notes } = useNoteStore();
  const { entries } = useDiaryStore();
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const backupData = await collectBackupData();
      const jsonString = JSON.stringify(backupData, null, 2);
      const method = await saveBackupToDisk(jsonString);

      if (method === 'cancelled') {
        setStatus({ type: null, message: '' });
        return;
      }

      setStatus({
        type: 'success',
        message: method === 'tauri'
          ? 'Backup file saved!'
          : 'Backup file downloaded! Check your Downloads folder.',
      });
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to export: ' + (error as Error).message });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatus({ type: null, message: '' }), 3000);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data && (data.tasks || data.notes || data.diary || data.automation || data.settings)) {
            restoreBackupData(data);
            setStatus({ type: 'success', message: 'Data imported successfully! Refreshing...' });
            setTimeout(() => window.location.reload(), 1500);
          } else {
            throw new Error('Invalid file format');
          }
        } catch (err) {
          setStatus({ type: 'error', message: 'Failed to import: Invalid file format' });
        } finally {
          setIsProcessing(false);
          setTimeout(() => setStatus({ type: null, message: '' }), 3000);
          event.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setIsProcessing(false);
      setStatus({ type: 'error', message: 'Error reading file' });
    }
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
          Download a complete backup of your tasks, notes, and diary entries.
        </p>
        <Button 
          onClick={handleExport} 
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          disabled={isProcessing}
        >
          <Download className="h-4 w-4" />
          {isProcessing ? 'Preparing...' : 'Download Backup'}
        </Button>
      </Card>

      <Card className="p-8 text-center border-dashed hover:border-indigo-500/50 transition-colors">
        <Upload className="h-16 w-16 mx-auto text-slate-600 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Import Data</h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Restore your data from a previous backup file.
        </p>
        <label className="inline-block">
          <input 
            type="file" 
            accept=".json" 
            onChange={handleImport} 
            className="hidden" 
            disabled={isProcessing}
          />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer transition-colors disabled:opacity-50">
            <Upload className="h-4 w-4" />
            Select File
          </span>
        </label>
      </Card>

      <div className="p-6 rounded-lg bg-slate-900/50 border border-slate-800">
        <h4 className="font-medium text-white mb-2">Current Statistics</h4>
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