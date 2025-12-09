
import { AppointmentStatus, AuditAction, AuditSource, User, UserRole } from '../types';
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
export { patientService } from './patientService';
export { settingsService } from './settingsService';
export { doctorAvailabilityService } from './doctorAvailabilityService';
export { rateLimiterService } from './rateLimiterService';
export { monitoringService } from './monitoring';
export { doctorService } from './doctorService';
export { appointmentService } from './appointmentService';

// NOTE: 'dataService' aggregator has been removed to enforce domain separation.
// Please import specific services (e.g., 'patientService', 'doctorService') directly.

export const webhookService = {
  processIncomingWebhook: async (payload: any, clinicId: string, token: string) => {
    // Mock valid tokens map for simulation
    const settings = await settingsService.getClinicSettings(clinicId);
    const validTokens = new Map<string, string>();
    if (settings.apiToken) {
        validTokens.set(clinicId, settings.apiToken);
    }
    
    // Create Synthetic System Actor for Webhook Operations
    // This allows the service layer to validate "who" is performing the action
    const systemActor: User = {
        id: 'n8n_system_user',
        name: 'N8N Automation',
        username: 'bot',
        email: 'bot@system.local',
        role: UserRole.DOCTOR_ADMIN, // Privileged role to manage clinic resources
        clinicId: clinicId // Bind to the clinic authenticated by the token
    };

    // Inject specific dependencies including slotReservationService
    return await N8NIntegrationService.receiveFromN8N(
      { ...payload, clinicId, authToken: token }, 
      validTokens, 
      {
        ...doctorService,
        ...patientService,
        ...appointmentService,
        ...settingsService,
        ...doctorAvailabilityService,
        createAppointment: (appt: any, source?: AuditSource, reservationId?: string) => 
          appointmentService.createAppointment(appt, source || AuditSource.N8N_WEBHOOK, reservationId, systemActor),
        updateAppointmentStatus: (id: string, status: AppointmentStatus, source?: AuditSource) => 
          appointmentService.updateAppointmentStatus(id, status, source || AuditSource.N8N_WEBHOOK, systemActor),
        createBatchAppointments: (appts: any, source?: AuditSource) => 
          appointmentService.createBatchAppointments(appts, systemActor, source || AuditSource.N8N_WEBHOOK),
        getOrCreatePatient: (data: any, source?: AuditSource) => 
          patientService.getOrCreatePatient(data, source || AuditSource.N8N_WEBHOOK, systemActor),
        logEvent: (params: any) => 
            systemLogService.createLog({ ...params, source: params.source || AuditSource.N8N_WEBHOOK }),
        slotReservationService: slotReservationService
      }
    );
  }
};
