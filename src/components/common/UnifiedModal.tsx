import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: React.ReactNode;
  isSubmitting?: boolean;
}

export function UnifiedModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSubmit, 
  submitLabel = "Save",
  isSubmitting = false
}: UnifiedModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (onSubmit) {
          const form = modalRef.current?.querySelector('form');
          if (form) form.requestSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSubmit]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <AnimatePresence>
        <motion.div 
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "w-full max-w-2xl max-h-[90vh] overflow-y-auto",
            "bg-[#0a192f] border border-cyan-500/20 rounded-2xl",
            "shadow-[0_0_30px_-5px_rgba(0,255,255,0.15)]"
          )}
        >
          <div className="flex items-center justify-between p-6 border-b border-cyan-900/30 sticky top-0 bg-[#0a192f] z-10">
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
            <button 
              type="button" 
              onClick={onClose} 
              className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-900/20 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {onSubmit ? (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="first-input-marker">{children}</div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-cyan-900/30 mt-6">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-all transform active:scale-95",
                      "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? 'Processing...' : submitLabel}
                  </button>
                </div>
              </form>
            ) : (
              children
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}