
import { AgendaConfig, ClinicSettings, AuditAction, AuditSource } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialAgendaConfigs, initialSettings } from './storage';
import { systemLogService } from './auditService';
import { socketServer, SocketEvent } from '../lib/socketServer';

// Helper to avoid circular dependency
const getCurrentUserId = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return stored ? JSON.parse(stored).id : 'system';
    } catch { return 'system'; }
};

export const settingsService = {
  getAgendaConfig: async (clinicId: string, doctorId?: string): Promise<AgendaConfig> => {
      const configs = getStorage<AgendaConfig[]>(STORAGE_KEYS.AGENDA_CONFIG, initialAgendaConfigs);
      if (doctorId) {
          const docConfig = configs.find(c => c.clinicId === clinicId && c.doctorId === doctorId);
          if (docConfig) return docConfig;
      }
      const clinicConfig = configs.find(c => c.clinicId === clinicId && !c.doctorId);
      const base = clinicConfig || initialAgendaConfigs[0];
      return { ...base, clinicId, doctorId };
  },
  
  updateAgendaConfig: async (newConfig: AgendaConfig): Promise<void> => {
      await delay(300);
      let configs = getStorage<AgendaConfig[]>(STORAGE_KEYS.AGENDA_CONFIG, initialAgendaConfigs);
      const index = configs.findIndex(c => c.clinicId === newConfig.clinicId && c.doctorId === newConfig.doctorId);
      if (index >= 0) configs[index] = newConfig; else configs.push(newConfig);
      setStorage(STORAGE_KEYS.AGENDA_CONFIG, configs);
      
      systemLogService.createLog({
        organizationId: newConfig.clinicId,
        action: AuditAction.AGENDA_CONFIG_UPDATED,
        entityType: 'Config',
        entityId: newConfig.doctorId || 'clinic_default',
        entityName: 'Agenda Config',
        description: `Atualizou configurações da agenda ${newConfig.doctorId ? '(Médico)' : '(Geral)'}`,
        source: AuditSource.WEB_APP
      });

      // ✅ WEBSOCKET EMIT
      socketServer.emit(
        SocketEvent.AGENDA_CONFIG_UPDATED,
        newConfig,
        newConfig.clinicId,
        getCurrentUserId()
      );
  },

  getProcedureOptions: async (clinicId: string, doctorId?: string): Promise<string[]> => {
      const config = await settingsService.getAgendaConfig(clinicId, doctorId);
      return config?.availableProcedures || ['Consulta'];
  },
  
  getClinicSettings: async (clinicId: string): Promise<ClinicSettings> => {
      const settings = getStorage<ClinicSettings[]>(STORAGE_KEYS.CLINIC_SETTINGS, initialSettings);
      let clinicSetting = settings.find(s => s.clinicId === clinicId);
      if (!clinicSetting) {
          // GOVERNANCE: Use crypto.randomUUID()
          clinicSetting = { clinicId, clinicToken: crypto.randomUUID() };
          settings.push(clinicSetting);
          setStorage(STORAGE_KEYS.CLINIC_SETTINGS, settings);
      }
      return clinicSetting;
  },
  
  updateClinicSettings: async (newSettings: ClinicSettings): Promise<void> => {
      await delay(300);
      let settings = getStorage<ClinicSettings[]>(STORAGE_KEYS.CLINIC_SETTINGS, initialSettings);
      const index = settings.findIndex(s => s.clinicId === newSettings.clinicId);
      const oldSettings = index >= 0 ? settings[index] : undefined;
      
      if (index >= 0) settings[index] = newSettings; else settings.push(newSettings);
      setStorage(STORAGE_KEYS.CLINIC_SETTINGS, settings);
      
      systemLogService.createLog({
        organizationId: newSettings.clinicId,
        action: AuditAction.SETTINGS_UPDATED,
        entityType: 'Settings',
        entityId: 'clinic_settings',
        entityName: 'Integrações',
        description: 'Atualizou configurações de API/Webhook',
        metadata: { productionModeChanged: oldSettings?.n8nProductionMode !== newSettings.n8nProductionMode },
        source: AuditSource.WEB_APP
      });

      // ✅ WEBSOCKET EMIT
      socketServer.emit(
        SocketEvent.SETTINGS_UPDATED,
        newSettings,
        newSettings.clinicId,
        getCurrentUserId()
      );
  },
};
