import { useEffect, useState } from 'react';
import { Sidebar } from './components/common/Sidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { ViewBoundary } from './components/common/ViewBoundary';
import { FocusOverlay } from './components/common/FocusOverlay';
import { TaskModal } from './components/todo/TaskModal';
import { NoteModal } from './components/notes/NoteModal';
import { DiaryModal } from './components/diary/DiaryModal';
import { AutomationModal } from './components/common/AutomationModal';
import { GlobalAddModal } from './components/common/GlobalAddModal';
import { AutoBackup } from './components/common/AutoBackup';
import { DashboardView } from './components/analytics/DashboardView';
import { ListView } from './components/todo/ListView';
import { KanbanView } from './components/todo/KanbanView';
import { MatrixView } from './components/todo/MatrixView';
import { NotesView } from './components/notes/NotesView';
import { DiaryView } from './components/diary/DiaryView';
import { SilentBoyView } from './components/silentboy/SilentBoyView';
import { PlannerView } from './components/planner/PlannerView';
import { ClassesView } from './components/classes/ClassesView';
import { BoostersView } from './components/boosters/BoostersView';
import { TagsView } from './components/tags/TagsView';
import { SettingsView } from './components/settings/SettingsView';
import { AutomationView } from './components/automation/AutomationView';
import { useUIStore } from './stores/uiStore';
import { useFocusStore } from './stores/focusStore';
import { useTaskStore } from './stores/taskStore';
import { useNoteStore } from './stores/noteStore';
import { usePlannerStore } from './stores/plannerStore';
import { useBoosterStore } from './stores/boosterStore';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { emit, listen } from '@tauri-apps/api/event';
import { applyBoosterChangeWithStudy } from './lib/boosterStudy';
import type { BoosterAction } from './stores/boosterStore';
import { InAppToastHost, showInAppToast } from './components/common/InAppToast';
import { FocusWaterShader } from './components/common/FocusWaterShader';
import { AnalyticsModal } from './components/common/AnalyticsModal';
import { cn } from './lib/utils';
import {
  Menu, X, BookMarked, Atom, FlaskConical, Sigma, Star, PlusCircle, Pencil,
  ListTodo, BarChart3, NotebookPen
} from 'lucide-react';

/**
 * Fires task and study reminders.
 *
 * Its own component on purpose. It needs the task list, and a component that
 * needs the whole task list would make every task edit re-render the entire app
 * — the booster grid included — if it lived in the root.
 */
function DueWatcher() {
  const tasks = useTaskStore((s) => s.tasks);
  const markTaskNotified = useTaskStore((s) => s.markTaskNotified);
  const reminders = usePlannerStore((s) => s.reminders);
  const markReminderFired = usePlannerStore((s) => s.markReminderFired);

  useEffect(() => {
    const checkDueTasks = () => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:mm"
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const currentDate = `${year}-${month}-${day}`; // "YYYY-MM-DD"

      tasks.forEach((task) => {
        if (task.isScheduled && task.dueDate === currentDate && task.dueTime === currentTime && !task.notified) {
          // a) In-App Toast
          showInAppToast(`⏰ Task Reminder: ${task.title}`);

          // b) Native OS Notification (best-effort)
          try {
            const result = sendNotification({
              title: 'Task Due',
              body: `${task.title} is scheduled for ${task.dueTime}`,
              icon: "icon.png",
              sound: "Default"
            }) as unknown as Promise<void> | void;
            if (result && typeof (result as Promise<void>).catch === 'function') {
              (result as Promise<void>).catch((err) => console.error('OS notification failed:', err));
            }
          } catch (err) {
            console.error('OS notification failed:', err);
          }

          // c) Mark as notified immediately so it never fires again
          markTaskNotified(task.id);
        }
      });

      // Study reminders from the planner — fire once per day, each at its HH:mm.
      reminders.forEach((reminder) => {
        if (reminder.time !== currentTime) return;
        if (reminder.lastFiredDate === currentDate) return;

        showInAppToast(`📚 Reminder: Time for ${reminder.subject}`);
        try {
          const result = sendNotification({
            title: 'Study Reminder',
            body: `${reminder.subject} — ${reminder.message || 'Time to study'}`,
            icon: 'icon.png',
            sound: 'Default',
          }) as unknown as Promise<void> | void;
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch((err) => console.error('OS notification failed:', err));
          }
        } catch (err) {
          console.error('OS notification failed:', err);
        }
        markReminderFired(reminder.id, currentDate);
      });
    };

    const interval = setInterval(checkDueTasks, 60000); // Check every minute
    checkDueTasks(); // Also check immediately on mount/tasks change

    return () => clearInterval(interval);
  }, [tasks, markTaskNotified, reminders, markReminderFired]);

  return null;
}

/** Used in the error boundary, so a failure names the screen it came from. */
const SCREEN_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  planner: 'Study Planner',
  tasks: 'Tasks',
  notes: 'Notes',
  diary: 'Diary',
  boosters: 'Boosters',
  silentboy: 'SilentBoy',
  tags: 'Tags',
  automation: 'Automation',
  settings: 'Settings',
  classes: 'Classes',
};
function App() {
  // Subscribe to single values rather than whole stores.
  //
  // `useTaskStore()` and `useFocusStore()` with no selector return the entire
  // store, so any change to any task or any study-analytics row re-rendered this
  // component and everything under it — including the booster grid's 460 tiles.
  // Every booster tap writes study analytics, so marking one episode watched was
  // rebuilding the whole app. Narrow selectors keep a change scoped to the
  // components that actually read the value.
  const currentView = useUIStore((s) => s.currentView);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const theme = useUIStore((s) => s.theme);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setView = useUIStore((s) => s.setView);

  const isActive = useFocusStore((s) => s.isActive);
  const isRunning = useFocusStore((s) => s.isRunning);
  const activeTaskId = useFocusStore((s) => s.activeTaskId);
  const selectedSubject = useFocusStore((s) => s.selectedSubject);
  const currentSessionSeconds = useFocusStore((s) => s.currentSessionSeconds);
  const startTimer = useFocusStore((s) => s.startTimer);
  const pauseTimer = useFocusStore((s) => s.pauseTimer);
  const resetTimer = useFocusStore((s) => s.resetTimer);
  const setSubject = useFocusStore((s) => s.setSubject);
  const toggleFocusMode = useFocusStore((s) => s.toggleFocusMode);
  const addManualTime = useFocusStore((s) => s.addManualTime);
  const editDailyTotal = useFocusStore((s) => s.editDailyTotal);
  const studyAnalytics = useFocusStore((s) => s.studyAnalytics);
  // The focus store's own advance function, not the elapsed seconds: naming a
  // number `tick` and then calling it was the source of a type error, and
  // conflating the two made the timer's dependency unclear.
  const tick = useFocusStore((s) => s.tick);

  const addTask = useTaskStore((s) => s.addTask);
  const addNote = useNoteStore((s) => s.addNote);

  const isSilentMode = isActive;

  // Study analytics modal
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Drop animation state (hoisted — hooks must not be conditional)
  const [fluidDraining, setFluidDraining] = useState(false);

  // Session-based fluid progress: 0..100 within the current hour of the running session
  const fluidProgressPct = (currentSessionSeconds % 3600) / 3600 * 100;

  // Smoothed progress — lerps toward the live value; on a hard drop (hour rollover)
  // it eases down over ~1s instead of snapping to 0.
  const [displayedProgress, setDisplayedProgress] = useState(fluidProgressPct);
  const displayedRef = { current: displayedProgress } as { current: number };
  useEffect(() => {
    displayedRef.current = displayedProgress;
  }, [displayedProgress]);

  useEffect(() => {
    let raf = 0;
    const tickFrame = () => {
      const target = fluidProgressPct;
      const cur = displayedRef.current;
      if (target === 0 && cur > 0) {
        // Reset pressed → aggressively drain to empty
        const next = cur - 2.0;
        setDisplayedProgress(next <= 0 ? 0 : next);
      } else if (target < cur - 1) {
        // Hour rollover — ease-out drain ~1s
        const next = cur - Math.max(0.5, cur * 0.12);
        if (next <= target) setDisplayedProgress(target);
        else setDisplayedProgress(next);
      } else if (Math.abs(target - cur) > 0.01) {
        setDisplayedProgress(target);
      }
      raf = requestAnimationFrame(tickFrame);
    };
    raf = requestAnimationFrame(tickFrame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fluidProgressPct]);

  const todayKeyForDrop = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const todaySubjectSecondsForDrop = selectedSubject
    ? (studyAnalytics[todayKeyForDrop]?.[selectedSubject] ?? 0) + currentSessionSeconds
    : 0;
  const hoursEarned = Math.floor(todaySubjectSecondsForDrop / 3600);

  useEffect(() => {
    if (hoursEarned > 0) {
      setFluidDraining(true);
      const t = setTimeout(() => setFluidDraining(false), 1000);
      return () => clearTimeout(t);
    }
  }, [hoursEarned]);

  const STUDY_SUBJECTS = [
    { name: 'AL Physics', icon: Atom },
    { name: 'AL Chemistry', icon: FlaskConical },
    { name: 'Combined Maths', icon: Sigma },
    { name: 'General English', icon: BookMarked },
  ];

  // Apply the light/dark theme to <body> so the CSS light-mode overrides activate.
  useEffect(() => {
    const body = document.body;
    if (theme === 'light') body.classList.add('light-mode');
    else body.classList.remove('light-mode');
  }, [theme]);

  // Quick Capture overlay → stores. The overlay window emits 'quick-capture'
  // from anywhere on the PC; we persist it here and confirm with a toast.
  useEffect(() => {
    const unlisten = listen('quick-capture', (event) => {
      const payload = event.payload as {
        kind: 'task' | 'note';
        title: string;
        content: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
      };
      if (!payload || !payload.title) return;

      if (payload.kind === 'task') {
        addTask({
          title: payload.title,
          description: payload.content || undefined,
          status: 'todo',
          priority: payload.priority || 'medium',
          category: 'General',
          tags: [],
        });
      } else {
        addNote({
          title: payload.title,
          content: payload.content || '',
          folder: 'Quick Capture',
          tags: [],
        });
      }
      showInAppToast(
        payload.kind === 'task' ? `✅ Task captured: ${payload.title}` : `📝 Note captured: ${payload.title}`
      );
    });
    return () => {
      unlisten.then((f) => f()).catch(() => {});
    };
  }, [addTask, addNote]);

  // Quick Capture overlay → booster tracker. The overlay window emits
  // 'booster-action'; we own persistence and the physics study-time connection,
  // then echo the fresh series list back so the overlay stays in sync.
  useEffect(() => {
    const unlisten = listen<BoosterAction>('booster-action', (event) => {
      const payload = event.payload;
      if (!payload || !payload.series) return;
      applyBoosterChangeWithStudy(payload);
      void emit('booster-state', useBoosterStore.getState().series);
    });
    return () => {
      unlisten.then((f) => f()).catch(() => {});
    };
  }, []);

  // Request notification permission on startup
  useEffect(() => {

    const ensurePermission = async () => {
      try {
        if (!(await isPermissionGranted())) {
          await requestPermission();
        }
      } catch (error) {
        // Not fatal — in-app toasts still work without OS permission
        console.warn('Notification permission unavailable:', error);
      }
    };
    ensurePermission();
  }, []);

  // Notification Engine
  <DueWatcher />


  // Focus timer ticking — drives countdown and auto-completes sessions
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const renderView = () => {
    if (isSilentMode) {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Total seconds today per subject (DB) + current un-saved session
      const subjectEntries = STUDY_SUBJECTS.map(({ name }) => {
        const dbSeconds = studyAnalytics[todayKey]?.[name] ?? 0;
        const currentSession = name === selectedSubject ? currentSessionSeconds : 0;
        return { name, seconds: dbSeconds + currentSession };
      });
      const maxSeconds = Math.max(1, ...subjectEntries.map((e) => e.seconds));
      const hasSelection = !!selectedSubject;

      // Stopwatch display (current session in HH:MM:SS)
      const ss = String(currentSessionSeconds % 60).padStart(2, '0');
      const mm = String(Math.floor(currentSessionSeconds / 60) % 60).padStart(2, '0');
      const hh = String(Math.floor(currentSessionSeconds / 3600)).padStart(2, '0');
      const timeDisplay = `${hh}:${mm}:${ss}`;

      const draining = fluidDraining;
      const todaySubjectSeconds = selectedSubject
        ? (studyAnalytics[todayKey]?.[selectedSubject] ?? 0) + currentSessionSeconds
        : 0;
      const stars = hasSelection ? Math.floor(todaySubjectSeconds / 3600) : 0;

      return (
        <div className="flex flex-col items-center justify-center h-full w-full animate-in fade-in duration-500 relative [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {/* Close button — returns to dashboard */}
          <button
            onClick={toggleFocusMode}
            title="Exit Focus Mode"
            className="fixed top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/5 border border-white/10 text-slate-500 hover:text-white hover:border-white/40 backdrop-blur-md transition-all flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-center space-y-6 w-full max-w-2xl px-4">
            {/* Subject + stars header */}
            {hasSelection ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-[11px] text-cyan-500/80 tracking-[0.25em] uppercase">{selectedSubject}</p>
                {stars > 0 && (
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: stars }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
                    ))}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 tracking-[0.25em] uppercase">Select a subject to begin</p>
            )}

            {/* Radial layout: circle + three arc-tab buttons hugging the right edge.
                Each button's left corner is clipped to follow the circle's curve and
                its left edge is tangent to the circle, so the trio reads as one arc. */}
            <div className="relative w-full max-w-[480px] mx-auto h-64 flex justify-center">
              <div className="relative w-64 h-64 mr-32">
                {/* WebGL fluid — fills the wrapper exactly */}
                <div className="absolute inset-0 z-0">
                  <FocusWaterShader progressPct={displayedProgress} />
                </div>

                {/* Drain flash when an hour completes */}
                {draining && (
                  <div className="absolute inset-0 z-10 flex items-end justify-center overflow-hidden rounded-full pointer-events-none">
                    <div className="w-full h-full animate-[drain_1s_ease-in-out_forwards] bg-slate-900/90" />
                  </div>
                )}

                {/* Centered stopwatch */}
                <div className="absolute inset-0 z-10 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-5xl font-light text-white tabular-nums tracking-tighter drop-shadow-2xl">
                    {hasSelection ? timeDisplay : '00:00:00'}
                  </span>
                  {isRunning && hasSelection && (
                    <span className="text-[9px] text-slate-300 tracking-[0.3em] uppercase mt-1 animate-pulse">recording</span>
                  )}
                </div>

                {/* Right-arc buttons: each tab's left edge traces the circle's own
                    arc (center 128,128, r=129) so the trio reads as one continuous
                    surface — TASKS/NOTES bow ~14px, ANALYTICS sits at the equator
                    where the circle is nearly flat. Right corners stay rounded. */}
                {[
                  {
                    label: 'TASKS', icon: ListTodo, left: 225.9, top: 44,
                    clip: 'M0 0 H116 Q128 0 128 12 V28 Q128 40 116 40 H23.4 Q16.5 20 0 0 Z',
                    onClick: () => setView('list'),
                  },
                  {
                    label: 'ANALYTICS', icon: BarChart3, left: 255.4, top: 108,
                    clip: 'M0 0 H116 Q128 0 128 12 V28 Q128 40 116 40 H0 Q3.2 20 0 0 Z',
                    onClick: () => setIsAnalyticsOpen(true),
                  },
                  {
                    label: 'NOTES', icon: NotebookPen, left: 225.9, top: 172,
                    clip: 'M23.4 0 H116 Q128 0 128 12 V28 Q128 40 116 40 H0 Q16.5 20 23.4 0 Z',
                    onClick: () => setView('notes'),
                  },
                ].map((b) => (
                  <div
                    key={b.label}
                    style={{
                      left: b.left,
                      top: b.top,
                      clipPath: `path('${b.clip}')`,
                    }}
                    className="absolute z-20 arc-tab"
                  >
                    <button
                      onClick={b.onClick}
                      className="btn-press w-32 h-10 flex items-center justify-center gap-2 bg-gradient-to-r from-white/[0.10] to-white/[0.03] backdrop-blur-md text-white text-[11px] font-semibold tracking-widest transition-all hover:from-cyan-500/30 hover:to-cyan-500/10 hover:text-cyan-100"
                    >
                      <b.icon className="h-3.5 w-3.5 opacity-80" />
                      {b.label}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject chip selector (stars only in stats panel below) */}
            <div className="flex flex-wrap gap-2.5 justify-center">
              {STUDY_SUBJECTS.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  onClick={() => setSubject(name === selectedSubject ? null : name)}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-all",
                    selectedSubject === name
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                      : "text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-600",
                    isRunning && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {name}
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex gap-4 justify-center">
              {!isRunning ? (
                <button
                  onClick={startTimer}
                  disabled={!hasSelection}
                  className={cn(
                    "btn-press px-8 py-3 rounded-full font-bold transition-all transform",
                    hasSelection
                      ? "bg-cyan-500 hover:bg-cyan-400 text-black hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                      : "bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed"
                  )}
                >
                  Start Focus
                </button>
              ) : (
                <button onClick={pauseTimer} className="btn-press px-8 py-3 rounded-full bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all">
                  Pause
                </button>
              )}
              <button
                onClick={resetTimer}
                title="Abandon current session"
                className="btn-press px-8 py-3 rounded-full border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition-all"
              >
                Reset
              </button>
            </div>

            {activeTaskId && (
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md max-w-lg mx-auto">
                <h3 className="text-cyan-500 text-[10px] uppercase tracking-widest mb-1">Current Focus</h3>
                <p className="text-lg text-white font-light">Active Task Session</p>
              </div>
            )}

            {/* Study Analytics */}
            <FocusAnalyticsPanel
              subjectEntries={subjectEntries}
              maxSeconds={maxSeconds}
              todayKey={todayKey}
              onAddManual={(subject, secs) => addManualTime(subject, secs, todayKey)}
              onEditTotal={(subject, secs) => editDailyTotal(subject, secs, todayKey)}
            />
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'list': return <ListView />;
      case 'kanban': return <KanbanView />;
      case 'matrix': return <MatrixView />;
      case 'notes': return <NotesView />;
      case 'diary': return <DiaryView />;
      case 'silentboy': return <SilentBoyView onExit={() => setView('dashboard')} />;
      case 'planner': return <PlannerView />;
      case 'classes': return <ClassesView />;
      case 'boosters': return <BoostersView />;
      case 'tags': return <TagsView />;
      case 'settings': return <SettingsView />;
      case 'automation': return <AutomationView />;
      default: return <DashboardView />;
    }
  };

  const isSilentBoy = currentView === 'silentboy';

  return (
    <div className={cn(
      "flex h-screen w-screen font-sans selection:bg-cyan-500/30 overflow-hidden transition-colors duration-500 relative",
      isSilentMode || isSilentBoy
        ? "bg-[#000000] text-white"
        : theme === 'dark' 
          ? "bg-[#0a192f] text-cyan-50" 
          : "bg-slate-50 text-slate-900"
    )}>
      {/* Ambient aurora depth (hidden in immersive modes) */}
      {!(isSilentMode || isSilentBoy) && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="aurora-blob aurora-1" />
          <div className="aurora-blob aurora-2" />
          <div className="aurora-blob aurora-3" />
        </div>
      )}

      <AutoBackup />
      <InAppToastHost />
      <CommandPalette />
      <TaskModal />
      <NoteModal />
      <DiaryModal />
      <AutomationModal />
      <GlobalAddModal />
      <AnalyticsModal open={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
      
      {/* SilentBoy exit pill */}
      {isSilentBoy && !isSilentMode && (
        <button
          onClick={toggleSidebar}
          title="Show navigation"
          className="fixed top-6 left-6 z-50 p-3 rounded-xl bg-black/60 text-slate-500 hover:text-slate-200 border border-slate-800 backdrop-blur-md transition-all opacity-30 hover:opacity-80"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      <FocusOverlay>
        {!isSilentMode && !isSilentBoy && (
          <>
            {!sidebarOpen && (
              <button 
                onClick={toggleSidebar} 
                className="fixed top-6 left-6 z-50 p-3 rounded-xl bg-[#0f2442]/90 text-cyan-400 hover:text-cyan-200 shadow-[0_0_20px_rgba(8,145,178,0.4)] border border-cyan-900/50 backdrop-blur-md transition-all hover:scale-105"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
            <Sidebar />
          </>
        )}
        
        <main className={cn(
          "relative z-10 flex-1 h-full overflow-y-auto transition-all duration-500 scroll-smooth custom-scrollbar",
          isSilentMode || isSilentBoy
            ? "ml-0 w-full" 
            : sidebarOpen ? "ml-64" : "ml-0",
          isSilentBoy ? "p-0" : "p-8 md:p-12"
        )}>
          <div className={cn(
            "mx-auto pb-10 transition-all duration-500",
            isSilentMode ? "max-w-none h-full" : isSilentBoy ? "max-w-none h-full pb-0" : "max-w-7xl"
          )}>
            {/* One screen failing should not take the window with it: without a
                boundary, a throw in any view leaves a blank app with no way
                back and nothing on screen to say why. */}
            <ViewBoundary
              screen={SCREEN_NAMES[currentView] ?? 'current'}
              onLeave={() => setView('dashboard')}
            >
              {renderView()}
            </ViewBoundary>
          </div>
        </main>
      </FocusOverlay>
    </div>
  );
}

export default App;

/* ── Focus study analytics panel (per-day totals + manual entry + stars) ── */
interface SubjectEntry { name: string; seconds: number }

/** Triple H:M:S input shared by Add and Edit flows. */
function HmsInputs({
  hours, minutes, seconds,
  onHours, onMinutes, onSeconds, onSubmit, onCancel, accent,
}: {
  hours: string; minutes: string; seconds: string;
  onHours: (v: string) => void; onMinutes: (v: string) => void; onSeconds: (v: string) => void;
  onSubmit: () => void; onCancel: () => void; accent: 'cyan' | 'amber';
}) {
  const numCls = cn(
    'w-12 h-10 bg-white/5 border border-white/10 rounded-lg text-center text-white outline-none',
    'appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
    'focus:outline-none focus:ring-1',
    accent === 'cyan' ? 'focus:ring-cyan-500' : 'focus:ring-amber-500'
  );
  const keyHandler = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex flex-col items-center">
        <input type="number" min="0" max="99" value={hours} onChange={(e) => onHours(e.target.value)} onKeyDown={keyHandler} className={numCls} placeholder="0" />
        <span className="text-xs text-white/50 mt-1">h</span>
      </div>
      <span className="text-white/50">:</span>
      <div className="flex flex-col items-center">
        <input type="number" min="0" max="59" value={minutes} onChange={(e) => onMinutes(e.target.value)} onKeyDown={keyHandler} className={numCls} placeholder="0" />
        <span className="text-xs text-white/50 mt-1">m</span>
      </div>
      <span className="text-white/50">:</span>
      <div className="flex flex-col items-center">
        <input type="number" min="0" max="59" value={seconds} onChange={(e) => onSeconds(e.target.value)} onKeyDown={keyHandler} className={numCls} placeholder="0" />
        <span className="text-xs text-white/50 mt-1">s</span>
      </div>
    </div>
  );
}

function FocusAnalyticsPanel({
  subjectEntries,
  maxSeconds,
  todayKey,
  onAddManual,
  onEditTotal,
}: {
  subjectEntries: SubjectEntry[];
  maxSeconds: number;
  todayKey: string;
  onAddManual: (subject: string, seconds: number) => void;
  onEditTotal: (subject: string, totalSeconds: number) => void;
}) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<'add' | 'edit'>('add');
  const [h, setH] = useState('0');
  const [m, setM] = useState('0');
  const [s, setS] = useState('0');

  const fmt = (sec: number) => {
    if (sec <= 0) return '0m';
    const hh = Math.floor(sec / 3600);
    const mm = Math.round((sec % 3600) / 60);
    return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
  };

  const openPopover = (name: string, mode: 'add' | 'edit', currentSeconds: number) => {
    const sameTarget = openFor === name && openMode === mode;
    if (sameTarget) { setOpenFor(null); return; }
    setOpenFor(name);
    setOpenMode(mode);
    if (mode === 'edit') {
      setH(String(Math.floor(currentSeconds / 3600)));
      setM(String(Math.floor((currentSeconds % 3600) / 60)));
      setS(String(currentSeconds % 60));
    } else {
      setH('0'); setM('0'); setS('0');
    }
  };

  const submit = (name: string) => {
    const totalSecs = (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
    if (openMode === 'add') {
      if (totalSecs > 0) onAddManual(name, totalSecs);
    } else {
      onEditTotal(name, totalSecs);
    }
    setOpenFor(null);
  };

  return (
    <div className="mt-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-left">
      <h3 className="text-[10px] uppercase tracking-widest text-slate-600 mb-4">
        Study Time · {todayKey}
      </h3>
      <div className="space-y-3">
        {subjectEntries.map(({ name, seconds }) => {
          const stars = Math.floor(seconds / 3600);
          const open = openFor === name;
          const isEdit = openMode === 'edit';
          return (
            <div key={name}>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  {name}
                  {stars > 0 && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-300 text-amber-300" />
                      ))}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-500 tabular-nums">{fmt(seconds)}</span>
                  <button
                    onClick={() => openPopover(name, 'edit', seconds)}
                    title={`Edit total for ${name}`}
                    className="text-slate-600 hover:text-amber-400 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openPopover(name, 'add', 0)}
                    title={`Add time to ${name}`}
                    className="text-slate-600 hover:text-cyan-400 transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${(seconds / maxSeconds) * 100}%` }}
                />
              </div>

              {open && (
                <div className="mt-2 p-3 rounded-xl bg-white/[0.04] border border-white/10 animate-in fade-in slide-in-from-top-1">
                  <h3 className="text-sm font-semibold text-white/80 mb-3">
                    {isEdit ? 'Edit Time' : 'Add Time'}
                  </h3>
                  <HmsInputs
                    hours={h} minutes={m} seconds={s}
                    onHours={setH} onMinutes={setM} onSeconds={setS}
                    onSubmit={() => submit(name)}
                    onCancel={() => setOpenFor(null)}
                    accent={isEdit ? 'amber' : 'cyan'}
                  />
                  <button
                    onClick={() => submit(name)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      isEdit
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                    )}
                  >
                    {isEdit ? 'Set Total' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* CSS keyframe for the fluid drain animation — injected once at module load */
if (typeof document !== 'undefined' && !document.getElementById('fluid-drain-keyframes')) {
  const style = document.createElement('style');
  style.id = 'fluid-drain-keyframes';
  style.textContent = `
    @keyframes drain {
      0% { transform: scaleY(0); transform-origin: bottom; }
      100% { transform: scaleY(1); transform-origin: bottom; }
    }
  `;
  document.head.appendChild(style);
}
