import { Sidebar } from './components/common/Sidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { FocusOverlay } from './components/common/FocusOverlay';
import { TaskModal } from './components/todo/TaskModal';
import { NoteModal } from './components/notes/NoteModal';
import { DiaryModal } from './components/diary/DiaryModal';
import { NotificationModal } from './components/common/NotificationModal';
import { DashboardView } from './components/analytics/DashboardView';
import { ListView } from './components/todo/ListView';
import { KanbanView } from './components/todo/KanbanView';
import { MatrixView } from './components/todo/MatrixView';
import { NotesView } from './components/notes/NotesView';
import { DiaryView } from './components/diary/DiaryView';
import { TagsView } from './components/tags/TagsView';
import { SettingsView } from './components/settings/SettingsView';
import { ImportExportView } from './components/settings/ImportExportView';
import { useUIStore } from './stores/uiStore';
import { cn } from './lib/utils';
import { Menu } from 'lucide-react';

function App() {
  const { currentView, sidebarOpen, toggleSidebar, theme } = useUIStore();
  
  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'list': return <ListView />;
      case 'kanban': return <KanbanView />;
      case 'matrix': return <MatrixView />;
      case 'notes': return <NotesView />;
      case 'diary': return <DiaryView />;
      case 'tags': return <TagsView />;
      case 'settings': return <SettingsView />;
      case 'import-export': return <ImportExportView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className={cn(
      "flex h-screen font-sans selection:bg-emerald-500/30 overflow-hidden",
      theme === 'dark' 
        ? "bg-[#09090b] text-slate-100" 
        : "bg-gray-50 text-gray-900"
    )}>
      <CommandPalette />
      <TaskModal />
      <NoteModal />
      <DiaryModal />
      <NotificationModal />
      
      <FocusOverlay>
        {!sidebarOpen && (
          <button onClick={toggleSidebar} className="fixed top-4 left-4 z-30 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white shadow-lg">
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <Sidebar />
        
        <main className={cn(
          "flex-1 h-full overflow-y-auto transition-all duration-300 scroll-smooth",
          sidebarOpen ? "ml-64" : "ml-0",
          "p-8"
        )}>
          <div className="max-w-7xl mx-auto pb-10">
            {renderView()}
          </div>
        </main>
      </FocusOverlay>
    </div>
  );
}

export default App;