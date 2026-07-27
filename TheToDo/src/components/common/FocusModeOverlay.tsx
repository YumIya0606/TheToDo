import React from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

interface FocusModeOverlayProps {
  isActive: boolean;
  onExit: () => void;
  children: React.ReactNode;
}

export const FocusModeOverlay: React.FC<FocusModeOverlayProps> = ({ isActive, onExit, children }) => {
  const { toggleFocusMode } = useUIStore();

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-background"
    >
      {/* Ambient background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Minimize2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-gray-400">Silent Focus Mode</span>
        </div>
        
        <button
          onClick={() => { toggleFocusMode(); onExit(); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors text-sm"
        >
          <X className="h-4 w-4" />
          <span>Exit Focus</span>
        </button>
      </div>

      {/* Content - centered and distraction-free */}
      <div className={cn(
        "relative z-10 h-[calc(100vh-60px)] overflow-auto",
        "flex items-center justify-center p-8"
      )}>
        <div className="w-full max-w-4xl">
          {children}
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-600">
        Press <kbd className="px-2 py-1 rounded bg-white/10">Ctrl+Shift+F</kbd> to toggle
      </div>
    </motion.div>
  );
};
