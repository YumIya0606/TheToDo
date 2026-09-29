import { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useTaskStore } from '@/stores/taskStore';
import type { Task, Priority, TaskStatus } from '@/types';
import { createPortal } from 'react-dom';

interface InteractivePriorityBadgeProps {
  task: Task;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-600',
};

const STATUS_RING: Record<TaskStatus, string> = {
  todo: 'border-transparent',
  in_progress: 'border-cyan-400 border-dashed animate-spin-slow',
  completed: 'border-cyan-400 border-solid shadow-[0_0_8px_rgba(34,211,238,0.6)]',
  archived: 'border-slate-600',
};

export function InteractivePriorityBadge({ task }: InteractivePriorityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);
  const updateTask = useTaskStore((state) => state.updateTask);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
      setIsOpen(true);
    }
  };

  const handleUpdate = (field: 'priority' | 'status', value: Priority | TaskStatus) => {
    updateTask(task.id, { [field]: value });
    setIsOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const close = () => setIsOpen(false);
    if (isOpen) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen]);

  if (!task) return <div className="w-4 h-4 rounded-full bg-slate-700" />;

  const menuContent = (
    <div 
      className="fixed z-[9999] w-48 bg-[#0f2442] border border-cyan-900/50 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-cyan-900/30">
        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 px-2">Priority</p>
        {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
          <button
            key={p}
            onClick={() => handleUpdate('priority', p)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-cyan-900/20 hover:text-cyan-300 rounded-lg transition-colors"
          >
            <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[p]}`} />
            <span className="capitalize">{p}</span>
            {task.priority === p && <Check className="ml-auto h-3 w-3 text-cyan-400" />}
          </button>
        ))}
      </div>
      <div className="p-2">
        <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 px-2">Status</p>
        {(['todo', 'in_progress', 'completed'] as TaskStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => handleUpdate('status', s)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-cyan-900/20 hover:text-cyan-300 rounded-lg transition-colors"
          >
            <div className={`w-3 h-3 rounded-full border-2 ${STATUS_RING[s].split(' ')[0]} ${s === task.status ? 'bg-cyan-500/20' : 'bg-transparent'}`} />
            <span className="capitalize">{s.replace('_', ' ')}</span>
            {task.status === s && <Check className="ml-auto h-3 w-3 text-cyan-400" />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={badgeRef}
        onClick={handleClick}
        className={`w-4 h-4 rounded-full border-2 ${PRIORITY_COLORS[task.priority]} ${STATUS_RING[task.status]} transition-all transform hover:scale-110 cursor-pointer focus:outline-none`}
        title={`${task.priority} • ${task.status.replace('_', ' ')}`}
      />
      {isOpen && createPortal(menuContent, document.body)}
    </>
  );
}