import { useState, useEffect } from 'react';
import { User, Notification } from '../types';
import { notificationService } from '../services/notificationService';

export const useNotifications = (user: User) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = () => {
    if (!user) return;
    const items = notificationService.getNotificationsForUser(user.id, user.role, user.clinicId);
    setNotifications(items);
    setUnreadCount(items.filter(n => !n.read).length);
  };

  useEffect(() => {
    refresh();

    const handleUpdate = () => refresh();
    window.addEventListener('medflow:notification', handleUpdate);
    
    // Also listen to storage events to sync across tabs
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('medflow:notification', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [user?.id, user?.clinicId]);

  return {
    notifications,
    unreadCount,
    markAsRead: (id: string) => notificationService.markAsRead(id),
    markAllAsRead: () => notificationService.markAllAsRead(user.id, user.role, user.clinicId),
    clearAll: () => notificationService.clearAll(user.id, user.role, user.clinicId)
  };
};