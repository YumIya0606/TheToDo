import { 
  ClipboardList, 
  Settings, 
  Sun, 
  FileText, 
  Tag, 
  BookOpen, 
  ChevronDown,
  Target,
  Terminal,
  CalendarClock,
  Zap,
  Moon,
  Play,
  Radio
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useFocusStore } from '@/stores/focusStore';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const mainNavItems = [
  { icon: CalendarClock, label: 'Planner', view: 'planner' },
  { icon: Radio, label: 'Classes', view: 'classes' },
  { icon: Play, label: 'Boosters', view: 'boosters' },
  { icon: FileText, label: 'Notes', view: 'notes' },
  { icon: BookOpen, label: 'Diary', view: 'diary' },
  { icon: Moon, label: 'SilentBoy', view: 'silentboy' },
  { icon: Tag, label: 'Tags', view: 'tags' },
  { icon: Terminal, label: 'Automation', view: 'automation' },
];

const taskSubViews = [
  { view: 'dashboard', label: 'List View' },
  { view: 'kanban', label: 'Kanban' },
  { view: 'matrix', label: 'Matrix' },
];

export function Sidebar() {
  const { 
    sidebarOpen, 
    currentView, 
    setView, 
    openUniversalModal,
    theme, 
    toggleTheme 
  } = useUIStore();

  const { isActive, toggleFocusMode } = useFocusStore();
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  if (!sidebarOpen) return null;

  return (
    <aside className={cn(
      "sidebar-container w-64 flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
      currentView === 'silentboy'
        ? "bg-black/90 backdrop-blur-xl border-r border-white/10"
        : theme === 'dark' 
          ? "bg-[#0a192f]/95 border-r border-cyan-900/30 backdrop-blur-xl" 
          : "bg-white/80 border-r border-slate-200 backdrop-blur-xl shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]"
    )}>
      {/* Header */}
      <div className="p-6 pt-8">
        <h1 className={cn(
          "text-2xl font-bold tracking-tight transition-colors",
          theme === 'dark' 
            ? "bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent" 
            : "text-slate-900"
        )}>
          TheToDo
        </h1>
        <p className={cn(
          "text-xs mt-1 font-medium",
          theme === 'dark' ? "text-cyan-200/50" : "text-slate-500"
        )}>
          Productivity Suite
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar pb-4">
        
        {/* Main Tabs (Flat, Equal Hierarchy) */}
        <div className="space-y-1">
          {/* Tasks — main tab styled identically to the others; also acts as the expander for its sub-views */}
          <button
            onClick={() => setIsTasksExpanded(!isTasksExpanded)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
              (currentView === 'dashboard' || currentView === 'kanban' || currentView === 'matrix')
                ? theme === 'dark'
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-5px_rgba(34,211,238,0.3)]"
                  : "bg-blue-50 text-blue-600 border border-blue-200 shadow-sm"
                : theme === 'dark'
                  ? "text-slate-400 hover:bg-[#0f2442] hover:text-cyan-200 hover:translate-x-1"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-1"
            )}
          >
            <ClipboardList className={cn(
              "icon-pop h-5 w-5 transition-colors",
              (currentView === 'dashboard' || currentView === 'kanban' || currentView === 'matrix')
                ? "text-current"
                : theme === 'dark' ? "text-slate-500 group-hover:text-cyan-300" : "text-slate-400 group-hover:text-slate-600"
            )} />
            <span className="flex-1 text-left">Tasks</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isTasksExpanded ? "rotate-0" : "-rotate-90")} />
          </button>

          {/* Task Sub-Views (Nested Children) */}
          {isTasksExpanded && (
            <div className="space-y-0.5 relative">
              {/* Indent Line */}
              <div className="absolute left-6 top-1 bottom-1 w-px bg-cyan-900/30" />
              
              {taskSubViews.map((sub) => (
                <button
                  key={sub.view}
                  onClick={() => setView(sub.view as any)}
                  className={cn(
                    "w-full flex items-center gap-2.5 pl-12 py-2 rounded-lg text-sm transition-all duration-200 text-left",
                    currentView === sub.view
                      ? theme === 'dark'
                        ? "text-cyan-400 bg-cyan-500/10"
                        : "text-blue-600 bg-blue-50"
                      : theme === 'dark'
                        ? "text-slate-400 hover:text-cyan-200 hover:bg-[#0f2442]/50"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <span className="text-[10px] leading-none">•</span>
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {mainNavItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
                currentView === item.view
                  ? theme === 'dark'
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_-5px_rgba(34,211,238,0.3)]"
                    : "bg-blue-50 text-blue-600 border border-blue-200 shadow-sm"
                  : theme === 'dark'
                    ? "text-slate-400 hover:bg-[#0f2442] hover:text-cyan-200 hover:translate-x-1"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-1"
              )}
            >
              <item.icon className={cn(
                "icon-pop h-5 w-5 transition-colors",
                currentView === item.view 
                  ? "text-current" 
                  : theme === 'dark' ? "text-slate-500 group-hover:text-cyan-300" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-inherit relative">
        
        {/* Universal Create Modal trigger */}
        <button
          onClick={openUniversalModal}
          className={cn(
            "btn-press w-full flex items-center justify-center px-4 py-3 rounded-xl font-semibold shadow-lg transition-all transform active:scale-95 mb-4 cursor-pointer",
            currentView === 'silentboy'
              ? "bg-white/10 text-white hover:bg-white/20 shadow-none"
              : theme === 'dark'
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_4px_20px_-4px_rgba(6,182,212,0.4)] hover:shadow-[0_6px_25px_-4px_rgba(6,182,212,0.6)]"
                : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-[0_4px_20px_-4px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_25px_-4px_rgba(37,99,235,0.6)]"
          )}
        >
          <span>+ New Item</span>
        </button>

        {/* Bottom Icons */}
        <div className="flex gap-2">
          <button
            onClick={() => invoke('toggle_quick_capture').catch((e) => console.error(e))}
            title="Quick Capture (Ctrl+Shift+X)"
            className={cn(
              "flex-1 p-3 rounded-xl flex items-center justify-center transition-all duration-300",
              currentView === 'silentboy'
                ? "bg-white/10 text-cyan-300 hover:bg-white/20"
                : theme === 'dark'
                  ? "bg-[#060f1c] text-cyan-400 hover:bg-[#0f2442] hover:shadow-[0_0_12px_-3px_rgba(34,211,238,0.6)]"
                  : "bg-slate-100 text-blue-600 hover:bg-white"
            )}
          >
            <Zap className="h-5 w-5" />
          </button>

          <button
            onClick={toggleFocusMode}
            title="Focus Mode"
            className={cn(
              "flex-1 p-3 rounded-xl flex items-center justify-center transition-all duration-300",
              isActive 
                ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                : theme === 'dark'
                  ? "bg-[#060f1c] text-slate-400 hover:text-cyan-400 hover:bg-[#0f2442]"
                  : "bg-slate-100 text-slate-500 hover:text-blue-600 hover:bg-white"
            )}
          >
            <Target className="h-5 w-5" />
          </button>
          
          <button
            onClick={toggleTheme}
            className={cn(
              "flex-1 p-3 rounded-xl flex items-center justify-center transition-all duration-300",
              theme === 'dark'
                ? "bg-[#060f1c] text-yellow-400 hover:text-yellow-300 hover:bg-[#0f2442]"
                : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-white"
            )}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          
          <button
            onClick={() => setView('settings')}
            className={cn(
              "flex-1 p-3 rounded-xl flex items-center justify-center transition-all duration-300",
              theme === 'dark'
                ? "bg-[#060f1c] text-slate-400 hover:text-cyan-400 hover:bg-[#0f2442]"
                : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-white"
            )}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}