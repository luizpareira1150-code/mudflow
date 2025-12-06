
import { AppointmentStatus, AuditAction, AuditSource } from '../types';
import { N8NIntegrationService } from './n8nIntegration';
import { slotReservationService } from './slotReservationService';

// Import split services
import { authService } from './authService';
import { systemLogService } from './auditService';
import { doctorService } from './doctorService';
import { patientService } from './patientService';
import { appointmentService } from './appointmentService';
import { settingsService } from './settingsService';
import { analyticsService } from './analyticsService';
import { doctorAvailabilityService } from './doctorAvailabilityService';
import { rateLimiterService } from './rateLimiterService';
import { monitoringService } from './monitoring';

// Re-export specific services for direct usage
export { authService } from './authService';
export { systemLogService } from './auditService';
export { analyticsService } from './analyticsService';
export { patientService } from './patientService'; // Exporting this helps other components imports
export { settingsService } from './settingsService';
export { doctorAvailabilityService } from './doctorAvailabilityService';
export { rateLimiterService } from './rateLimiterService';
export { monitoringService } from './monitoring'; // New export

// Construct the Aggregated DataService
// This maintains backward compatibility for existing components
export const dataService = {
  ...doctorService,
  ...patientService,
  ...appointmentService,
  ...settingsService,
  ...doctorAvailabilityService,
  ...rateLimiterService,
  ...analyticsService // Include new analytics methods
  // Helper methods that might cross service boundaries or belong to the facade
};

export const webhookService = {
  processIncomingWebhook: async (payload: any, clinicId: string, token: string) => {
    // Mock valid tokens map for simulation
    const settings = await dataService.getClinicSettings(clinicId);
    const validTokens = new Map<string, string>();
    if (settings.apiToken) {
        validTokens.set(clinicId, settings.apiToken);
    }
    
    // Inject dependencies including slotReservationService
    return await N8NIntegrationService.receiveFromN8N(
      { ...payload, clinicId, authToken: token }, 
      validTokens, 
      {
        ...dataService,
        createAppointment: (appt: any, source?: AuditSource, reservationId?: string) => 
          dataService.createAppointment(appt, source || AuditSource.N8N_WEBHOOK, reservationId),
        updateAppointmentStatus: (id: string, status: AppointmentStatus, source?: AuditSource) => 
          dataService.updateAppointmentStatus(id, status, source || AuditSource.N8N_WEBHOOK),
        createBatchAppointments: (appts: any, source?: AuditSource) => 
          dataService.createBatchAppointments(appts, source || AuditSource.N8N_WEBHOOK),
        getOrCreatePatient: (data: any, source?: AuditSource) => 
          dataService.getOrCreatePatient(data, source || AuditSource.N8N_WEBHOOK),
        logEvent: (params: any) => 
            systemLogService.createLog({ ...params, source: params.source || AuditSource.N8N_WEBHOOK }),
        slotReservationService: slotReservationService
      }
    );
  }
};
