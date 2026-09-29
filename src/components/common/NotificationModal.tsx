import { X, Bell, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '../ui/Button';

const MOCK_NOTIFICATIONS = [
  { id: '1', type: 'info', title: 'Welcome Back', message: 'You have 3 tasks due today.', time: '2m ago' },
  { id: '2', type: 'success', title: 'Task Completed', message: 'Great job finishing "Project Report"', time: '1h ago' },
  { id: '3', type: 'warning', title: 'Upcoming Deadline', message: '"Meeting Prep" is due tomorrow', time: '3h ago' },
];

export function NotificationModal() {
  const { isNotificationModalOpen, closeNotificationModal } = useUIStore();

  if (!isNotificationModalOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-emerald-400" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      default: return <Info className="h-5 w-5 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            Notifications
          </h2>
          <button type="button" onClick={closeNotificationModal} className="text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {MOCK_NOTIFICATIONS.map((notif) => (
            <div key={notif.id} className="flex gap-3 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
              <div className="flex-shrink-0 mt-1">{getIcon(notif.type)}</div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white">{notif.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{notif.message}</p>
                <span className="text-[10px] text-slate-600 mt-2 block">{notif.time}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 text-center">
          <Button variant="ghost" size="sm" onClick={closeNotificationModal} className="w-full">
            Mark all as read
          </Button>
        </div>
      </div>
    </div>
  );
}