import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
}

let pushToast: ((message: string) => void) | null = null;

/** Fire an in-app toast from anywhere (imperative, no hook needed). */
export function showInAppToast(message: string) {
  pushToast?.(message);
}

export function InAppToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    pushToast = (message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    };
    return () => { pushToast = null; };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0f2442]/95 border border-cyan-500/40 shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] backdrop-blur-md max-w-sm"
          >
            <Bell className="h-5 w-5 text-cyan-400 flex-shrink-0" />
            <p className="text-sm text-cyan-50 font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
