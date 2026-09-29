import { useEffect, useState } from 'react';
import { sendNotification, requestPermission } from '@tauri-apps/plugin-notification';

export function NotificationHandler() {
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    // Request permission immediately on app load
    const initNotifications = async () => {
      try {
        const permission = await requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          console.log('✅ System notifications enabled');
        } else {
          console.warn('⚠️ System notifications denied by user');
        }
      } catch (error) {
        console.error('❌ Failed to request notification permission:', error);
      }
    };

    initNotifications();
  }, []);

  // Expose a global function for other components to trigger notifications easily
  useEffect(() => {
    window.triggerSystemNotification = (title: string, body: string) => {
      if (permissionGranted) {
        sendNotification({ title, body, icon: 'icon.png', sound: 'Default' });
      } else {
        console.warn('Notifications not permitted');
      }
    };
  }, [permissionGranted]);

  return null;
}

// Extend Window interface for our custom function
declare global {
  interface Window {
    triggerSystemNotification: (title: string, body: string) => void;
  }
}