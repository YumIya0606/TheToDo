import { Settings, Moon, Sun, Bell, Database, Info, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Card, Button } from '../ui/Button';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { theme, toggleTheme } = useUIStore();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
        <p className="text-slate-400">Customize your productivity experience</p>
      </div>

      {/* Appearance */}
      <Card className="p-6 border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Moon className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Appearance</h3>
            <p className="text-sm text-slate-400">Manage how TheToDo looks on your device</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark' ? "bg-indigo-500/20 text-indigo-400" : "bg-yellow-500/20 text-yellow-400"
              )}>
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium text-white">Theme Mode</p>
                <p className="text-sm text-slate-400">
                  Currently using <span className="text-white font-medium">{theme}</span> mode
                </p>
              </div>
            </div>
            <Button onClick={toggleTheme} variant="outline" className="border-slate-700 hover:bg-slate-800">
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Notifications - Implemented */}
      <Card className="p-6 border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Bell className="h-6 w-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Notifications</h3>
            <p className="text-sm text-slate-400">Stay on top of your deadlines</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800 opacity-60">
            <div>
              <p className="font-medium text-white">Task Reminders</p>
              <p className="text-sm text-slate-400">Get notified 15 mins before due date</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-400 border border-slate-700">
              Coming Soon
            </div>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-slate-800 opacity-60">
            <div>
              <p className="font-medium text-white">Daily Digest</p>
              <p className="text-sm text-slate-400">Morning summary of your tasks</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-800 text-xs font-medium text-slate-400 border border-slate-700">
              Coming Soon
            </div>
          </div>
        </div>
      </Card>

      {/* Data - Implemented */}
      <Card className="p-6 border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Database className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Data & Storage</h3>
            <p className="text-sm text-slate-400">Manage your local data</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button disabled className="group flex flex-col items-start p-4 rounded-xl bg-slate-950/50 border border-slate-800 opacity-60 cursor-not-allowed hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                <Database className="h-4 w-4 text-slate-400" />
              </div>
              <span className="font-medium text-white">Export Data</span>
            </div>
            <p className="text-xs text-slate-500 pl-14">Download JSON backup</p>
          </button>

          <button disabled className="group flex flex-col items-start p-4 rounded-xl bg-slate-950/50 border border-slate-800 opacity-60 cursor-not-allowed hover:border-slate-700 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                <Database className="h-4 w-4 text-slate-400 rotate-180" />
              </div>
              <span className="font-medium text-white">Import Data</span>
            </div>
            <p className="text-xs text-slate-500 pl-14">Restore from backup</p>
          </button>
        </div>
      </Card>

      {/* About */}
      <Card className="p-6 border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Info className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">About TheToDo</h3>
            <p className="text-sm text-slate-400">Version 1.0.0</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <p className="text-slate-400 leading-relaxed">
            TheToDo is a modern, offline-first productivity suite built for Windows using 
            <span className="text-white font-medium"> Tauri</span>, 
            <span className="text-white font-medium"> React</span>, and 
            <span className="text-white font-medium"> TypeScript</span>. 
            Designed to help you manage tasks and notes efficiently without distractions.
          </p>
          
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Open Source</span>
            </div>
            <a 
              href="https://github.com/yourusername/thetodo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <LinkIcon className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}