import { useState } from 'react';
import { BookOpen, Plus, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDiaryStore } from '@/stores/diaryStore';
import { Button, Card } from '../ui/Button';
import { cn } from '@/lib/utils';

export function DiaryView() {
  const { openDiaryModal } = useUIStore();
  const { entries } = useDiaryStore();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const hasEntry = (day: number) => {
    return entries.some(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const existingEntry = entries.find(e => {
      const d = new Date(e.date);
      return d.toDateString() === clickedDate.toDateString();
    });

    if (existingEntry) {
      openDiaryModal(existingEntry.id);
    } else {
      openDiaryModal(); 
    }
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-transparent" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
      const hasEntryForDay = hasEntry(day);

      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={cn(
            "h-24 border border-cyan-900/20 p-2 cursor-pointer transition-all relative group",
            isToday ? "bg-cyan-900/20 border-cyan-500/50" : "bg-[#0f2442]/40 hover:bg-[#0f2442]/80",
            "hover:border-cyan-500/50"
          )}
        >
          <span className={cn(
            "text-sm font-medium",
            isToday ? "text-cyan-400" : "text-slate-400 group-hover:text-white"
          )}>
            {day}
          </span>
          {hasEntryForDay && (
            <div className="absolute bottom-2 right-2 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-px bg-cyan-900/20 border border-cyan-900/20 rounded-2xl overflow-hidden mb-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-[#0a192f] p-3 text-center text-xs font-bold text-cyan-500/70 uppercase tracking-wider">
            {d}
          </div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Diary</h2>
          <p className="text-slate-400">Your private encrypted thoughts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#0f2442] rounded-lg p-1 border border-cyan-900/30">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === 'list' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-white"
              )}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === 'calendar' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-white"
              )}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => openDiaryModal()} className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white shadow-lg shadow-cyan-900/20">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-xl font-bold text-white">
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {viewMode === 'calendar' ? (
        renderCalendar()
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-cyan-900/30 bg-[#0f2442]/20">
          <BookOpen className="h-12 w-12 mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No entries yet</h3>
          <p className="text-slate-500 mb-4">Start writing your daily thoughts securely</p>
          <Button onClick={() => openDiaryModal()}>Create First Entry</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => {
            return (
              <div key={entry.id} onClick={() => openDiaryModal(entry.id)}>
                <Card className="p-6 cursor-pointer hover:border-cyan-500/50 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start justify-between pl-2">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-cyan-400">
                          {new Date(entry.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        {entry.isLocked && <Lock className="h-3 w-3 text-slate-500" />}
                      </div>
                      <p className="text-slate-300 line-clamp-2 group-hover:text-white transition-colors">
                        {entry.isLocked ? '🔒 This entry is encrypted' : entry.content.slice(0, 150)}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}