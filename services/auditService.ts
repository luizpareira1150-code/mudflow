import { AuditLog, AuditSource, User } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, initialLogs, delay } from './storage';

// Helper to avoid circular dependency with authService
const getCurrentUserFromStorage = (): User | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return stored ? JSON.parse(stored) : null;
};

export const systemLogService = {
  getLogs: async (
    clinicId: string, 
    filters?: {
        searchTerm?: string;
        action?: string;
        source?: string;
        startDate?: string;
        endDate?: string;
    }
  ): Promise<AuditLog[]> => {
    await delay(300);
    const logs = getStorage<AuditLog[]>(STORAGE_KEYS.LOGS, initialLogs);
    
    let filtered = logs.filter(l => l.organizationId === clinicId);

    if (filters) {
        if (filters.action) {
            filtered = filtered.filter(l => l.action === filters.action);
        }
        if (filters.source) {
            filtered = filtered.filter(l => l.source === filters.source);
        }
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            start.setHours(0,0,0,0);
            filtered = filtered.filter(l => new Date(l.timestamp) >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            end.setHours(23,59,59,999);
            filtered = filtered.filter(l => new Date(l.timestamp) <= end);
        }
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(log => 
                (log.userName || '').toLowerCase().includes(term) ||
                (log.entityName || '').toLowerCase().includes(term) ||
                log.description.toLowerCase().includes(term) ||
                log.entityId.toLowerCase().includes(term)
            );
        }
    }

    // Sort desc
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  
  createLog: async (logParams: Omit<AuditLog, 'id' | 'timestamp' | 'createdAt' | 'userId' | 'userName'> & { userId?: string, userName?: string }) => {
    const logs = getStorage<AuditLog[]>(STORAGE_KEYS.LOGS, initialLogs);
    
    // Resolve user context independently to avoid circular deps
    let userId = logParams.userId;
    let userName = logParams.userName;

    if (!userId) {
        const currentUser = getCurrentUserFromStorage();
        if (currentUser) {
            userId = currentUser.id;
            userName = currentUser.name;
        } else {
            userId = 'system';
            userName = 'System';
        }
    }
    
    if (logParams.source === AuditSource.N8N_WEBHOOK) {
        userName = userName || 'N8N Automation';
        userId = userId || 'n8n_bot';
    }

    const newLog: AuditLog = {
      ...logParams,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      userId: userId!,
      userName: userName!
    };
    
    logs.push(newLog);
    setStorage(STORAGE_KEYS.LOGS, logs);
    return newLog;
  },

  getAuditStats: async (clinicId: string) => {
      const logs = await systemLogService.getLogs(clinicId);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const logsToday = logs.filter(l => new Date(l.timestamp) >= today);
      const errors = logs.filter(l => l.metadata?.error || l.description.toLowerCase().includes('erro') || l.description.toLowerCase().includes('falhou'));
      
      const userCounts = logs.reduce((acc, log) => {
          acc[log.userName || 'Unknown'] = (acc[log.userName || 'Unknown'] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      
      const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];

      return {
          totalLogs: logs.length,
          todayCount: logsToday.length,
          errorCount: errors.length,
          mostActiveUser: topUser ? { name: topUser[0], count: topUser[1] } : null
      };
  }
};