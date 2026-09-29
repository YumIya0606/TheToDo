import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Priority, TaskStatus } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'urgent': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'completed': return 'text-emerald-400';
    case 'in_progress': return 'text-blue-400';
    case 'archived': return 'text-slate-500';
    default: return 'text-slate-300';
  }
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}