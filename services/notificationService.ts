
import { Notification, NotificationType, NotificationPriority, UserRole } from '../types';
import { sanitizeInput } from '../utils/sanitizer';

const STORAGE_KEY = 'medflow_notifications';

class NotificationService {
  
  // Emit event to update React components
  private dispatchEvent() {
    window.dispatchEvent(new Event('medflow:notification'));
  }

  private getStoredNotifications(): Notification[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private playSound(priority: NotificationPriority) {
    // Simple beep sound using AudioContext (no external assets needed)
    if (priority === 'high' || priority === 'medium') {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        
        // High priority = Higher pitch, Medium = Lower
        oscillator.frequency.value = priority === 'high' ? 880 : 440; 
        
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            // Double beep for high priority
            if (priority === 'high') {
                setTimeout(() => {
                    const osc2 = audioContext.createOscillator();
                    const gain2 = audioContext.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioContext.destination);
                    osc2.frequency.value = 880;
                    gain2.gain.value = 0.1;
                    osc2.start();
                    setTimeout(() => osc2.stop(), 100);
                }, 100);
            }
        }, 150);
      } catch (e) {
        console.error("Audio playback failed", e);
      }
    }
  }

  // Core notify method
  async notify(params: {
    title: string;
    message: string;
    type: NotificationType;
    clinicId: string;
    priority?: NotificationPriority;
    targetUserId?: string;
    targetRole?: UserRole[];
    metadata?: any;
    actionLink?: string;
  }) {
    const notifications = this.getStoredNotifications();
    
    const newNotification: Notification = {
      // GOVERNANCE: Use crypto.randomUUID()
      id: crypto.randomUUID(),
      // SECURITY: Sanitize input to prevent Stored XSS via Webhooks
      title: sanitizeInput(params.title),
      message: sanitizeInput(params.message),
      type: params.type,
      priority: params.priority || 'medium',
      clinicId: params.clinicId,
      targetUserId: params.targetUserId,
      targetRole: params.targetRole,
      metadata: params.metadata,
      actionLink: params.actionLink,
      read: false,
      timestamp: new Date().toISOString()
    };

    // Prepend to list
    notifications.unshift(newNotification);
    
    // Limit storage to last 50 notifications per user (approximated here by total limit to keep simple)
    // In a real app we'd filter by user before limiting. 
    // Here we just keep last 200 global to prevent localStorage overflow.
    if (notifications.length > 200) {
        notifications.length = 200;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    
    // Only play sound if it's high/medium priority
    if (newNotification.priority && newNotification.priority !== 'low') {
        this.playSound(newNotification.priority);
    }
    
    this.dispatchEvent();

    return newNotification;
  }

  getNotificationsForUser(userId: string, role: UserRole, clinicId: string): Notification[] {
    const all = this.getStoredNotifications();
    
    return all.filter(n => {
      // 1. Must belong to the same clinic
      if (n.clinicId !== clinicId) return false;

      // 2. Targeted specifically to user OR targeted to user's role
      const isTargetUser = n.targetUserId === userId;
      const isTargetRole = n.targetRole && n.targetRole.includes(role);

      return isTargetUser || isTargetRole;
    });
  }

  markAsRead(notificationId: string) {
    const all = this.getStoredNotifications();
    const updated = all.map(n => n.id === notificationId ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.dispatchEvent();
  }

  markAllAsRead(userId: string, role: UserRole, clinicId: string) {
    const all = this.getStoredNotifications();
    const updated = all.map(n => {
       // Only mark read if it belongs to this user context
       const isForUser = n.clinicId === clinicId && (n.targetUserId === userId || (n.targetRole && n.targetRole.includes(role)));
       if (isForUser) {
           return { ...n, read: true };
       }
       return n;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    this.dispatchEvent();
  }
  
  clearAll(userId: string, role: UserRole, clinicId: string) {
      const all = this.getStoredNotifications();
      // Keep notifications that DO NOT belong to this user context (preserve other users' data)
      const filtered = all.filter(n => {
         const isForThisUser = n.clinicId === clinicId && (n.targetUserId === userId || (n.targetRole && n.targetRole.includes(role)));
         return !isForThisUser;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      this.dispatchEvent();
  }
}

export const notificationService = new NotificationService();
