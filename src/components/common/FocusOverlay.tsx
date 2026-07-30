import { Maximize2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';

export function FocusOverlay({ children }: { children: React.ReactNode }) {
  const { focusMode, toggleFocusMode } = useUIStore();

  if (!focusMode) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="absolute top-6 right-6">
        <Button variant="ghost" onClick={toggleFocusMode} className="gap-2 text-slate-400 hover:text-white">
          <Maximize2 className="h-4 w-4" /> Exit Focus
        </Button>
      </div>
      <div className="w-full max-w-3xl">
        {children}
      </div>
      <div className="absolute bottom-6 text-slate-600 text-sm">
        Focus Mode Active • Distractions Hidden
      </div>
    </div>
  );
}