import { 
  LayoutDashboard, 
  List, 
  KanbanSquare, 
  Grid3X3, 
  Plus, 
  Settings, 
  Moon, 
  Sun, 
  FileText, 
  Tag, 
  Bell, 
  BookOpen, 
  Download,
  ChevronDown,
  CheckSquare,
  LogOut
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: List, label: 'List View', view: 'list' },
  { icon: KanbanSquare, label: 'Kanban Board', view: 'kanban' },
  { icon: Grid3X3, label: 'Eisenhower Matrix', view: 'matrix' },
  { icon: FileText, label: 'Notes', view: 'notes' },
  { icon: BookOpen, label: 'Diary', view: 'diary' },
  { icon: Tag, label: 'Tags', view: 'tags' },
  { icon: Download, label: 'Import/Export', view: 'import-export' },
];

export function Sidebar() {
  const { 
    sidebarOpen, 
    currentView, 
    setView, 
    openNewItemDropdown, 
    closeNewItemDropdown, 
    isNewItemDropdownOpen,
    openTaskModal, 
    openNoteModal, 
    openDiaryModal,
    toggleFocusMode, 
    theme, 
    toggleTheme,
    openNotificationModal,
    toggleNewItemDropdown // Ensure this is destructured
  } = useUIStore();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeNewItemDropdown();
      }
    };

    if (isNewItemDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNewItemDropdownOpen, closeNewItemDropdown]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    openNewItemDropdown();
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    // Delay closing to allow mouse to move to dropdown content
    setTimeout(() => {
      if (!isHovering && dropdownRef.current && !dropdownRef.current.matches(':hover')) {
        closeNewItemDropdown();
      }
    }, 200);
  };

  const handleDropdownClick = (type: 'task' | 'note' | 'diary') => {
    closeNewItemDropdown();
    if (type === 'task') openTaskModal();
    if (type === 'note') openNoteModal();
    if (type === 'diary') openDiaryModal();
  };

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/50 flex flex-col h-screen fixed left-0 top-0 z-20 transition-all duration-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          TheToDo
        </h1>
        <p className="text-xs text-slate-500 mt-1">Productivity Suite</p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => setView(item.view as any)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
              currentView === item.view
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-100 hover:translate-x-1"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* New Item Button with Dropdown */}
      <div className="p-4 border-t border-slate-800 relative" ref={dropdownRef}>
        <div className="relative">
          <Button 
            onClick={toggleNewItemDropdown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="w-full gap-2 relative z-20"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
            <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform duration-200", isNewItemDropdownOpen && "rotate-180")} />
          </Button>

          {/* Dropdown Menu */}
          <div 
            className={cn(
              "absolute bottom-full left-0 w-full mb-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-30 transition-all duration-200 origin-bottom",
              isNewItemDropdownOpen 
                ? "opacity-100 scale-100 translate-y-0 visible" 
                : "opacity-0 scale-95 translate-y-2 invisible pointer-events-none"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="py-2">
              <button
                onClick={() => handleDropdownClick('task')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
              >
                <CheckSquare className="h-4 w-4" />
                <span>Task</span>
              </button>
              <button
                onClick={() => handleDropdownClick('note')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Note</span>
              </button>
              <button
                onClick={() => handleDropdownClick('diary')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-purple-500/10 hover:text-purple-400 transition-colors border-t border-slate-800/50"
              >
                <LogOut className="h-4 w-4 rotate-180" />
                <span>Diary Entry</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-1 hover:text-yellow-400" 
            onClick={openNotificationModal}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-1" 
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="flex-1 hover:text-blue-400" 
            onClick={() => setView('settings')}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}