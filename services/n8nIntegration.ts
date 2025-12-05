import { ClinicSettings, AppointmentStatus, AuditAction, AuditSource, UserRole } from '../types';
import { N8NWebhookSchema } from '../utils/validationSchemas';
import { validateSafe } from '../utils/validator';
import { notificationService } from './notificationService';

// Gera token único para cada clínica
export const generateApiToken = (clinicId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `medflow_${clinicId}_${timestamp}_${random}`;
};

// Interface para payloads enviados AO N8N
export interface N8NOutgoingPayload {
  event: 'APPOINTMENT_CREATED' | 'STATUS_CHANGED' | 'AGENDA_BLOCKED' | 'DOCTOR_CREATED' | 'DOCTOR_UPDATED' | 'DOCTOR_DELETED' | 'PASSWORD_RECOVERY';
  data: {
    // Appointment Data
    appointmentId?: string;
    patientName?: string;
    patientPhone?: string;
    date?: string;
    time?: string;
    status?: string;
    oldStatus?: string;
    procedure?: string;
    notes?: string;
    
    // Doctor Data
    doctorId?: string;
    doctorName?: string;
    doctorSpecialty?: string;
    
    // Clinic Data
    clinicId: string;
    clinicName?: string;
    
    // Block Data
    blockedSlotsCount?: number;

    // Recovery Data
    userId?: string;
    email?: string;
    username?: string;
    requestTime?: string
    
    // Context
    [key: string]: any;
  };
  context?: any;
}

export const N8NIntegrationService = {
  
  // Envia dados para o N8N (Outbound)
  sendToN8N: async (payload: N8NOutgoingPayload, settings: ClinicSettings) => {
    if (!settings.n8nWebhookUrl) return;

    // Se não estiver em modo produção, apenas loga
    if (!settings.n8nProductionMode) {
      console.group('🚀 [N8N Simulation] Webhook Triggered');
      console.log('Target URL:', settings.n8nWebhookUrl);
      console.log('Event:', payload.event);
      console.log('Payload:', payload);
      console.groupEnd();
      return;
    }

    try {
      const response = await fetch(settings.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Clinic-Token': settings.clinicToken || '',
          'X-Api-Token': settings.apiToken || ''
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`N8N responded with ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send webhook to N8N:', error);
    }
  },

  // Recebe dados do N8N (Inbound Simulation)
  receiveFromN8N: async (
    payload: { action: string; data: any; clinicId: string; authToken: string }, 
    validTokens: Map<string, string>,
    context: any // Injected DataService to avoid circular dependencies
  ) => {
    
    // 1. Validação de Segurança
    const expectedToken = validTokens.get(payload.clinicId);
    if (!expectedToken || payload.authToken !== expectedToken) {
      throw new Error('Acesso Negado: Token de autenticação inválido.');
    }

    // 2. Validação do Payload
    const validation = validateSafe(N8NWebhookSchema, payload);
    if (!validation.success) {
      throw new Error(`Payload Inválido: ${validation.errors?.join(', ')}`);
    }

    const { action, data } = validation.data as any;

    // 3. Processamento da Ação
    switch (action) {
      case 'CREATE_APPOINTMENT': {
        // Criar Paciente se não existir
        const patient = await context.getOrCreatePatient({
           name: data.patientName || 'Paciente (Via WhatsApp)',
           phone: data.patientPhone || '',
           cpf: data.patientCPF,
           organizationId: payload.clinicId
        }, AuditSource.N8N_WEBHOOK);

        // Criar Agendamento
        const appt = await context.createAppointment({
            clinicId: payload.clinicId,
            doctorId: data.doctorId,
            patientId: patient.id,
            date: data.date,
            time: data.time,
            status: AppointmentStatus.AGENDADO,
            procedure: data.procedure || 'Agendamento via Bot',
            notes: data.notes
        }, AuditSource.N8N_WEBHOOK);

        // --- NOTIFICATION TRIGGER ---
        // Notify Secretary about new bot appointment
        await notificationService.notify({
            title: 'Novo Agendamento (Bot)',
            message: `${patient.name} agendou para ${data.date} às ${data.time} via WhatsApp.`,
            type: 'info',
            clinicId: payload.clinicId,
            targetRole: [UserRole.SECRETARY],
            priority: 'medium',
            actionLink: 'view:Agenda',
            metadata: {
                appointmentId: appt.id,
                patientId: patient.id,
                patientName: patient.name,
                source: 'WhatsApp Bot'
            }
        });

        return { success: true, id: appt.id, message: 'Agendamento criado via N8N' };
      }

      case 'UPDATE_STATUS': {
        if (!data.appointmentId || !data.newStatus) throw new Error('Dados incompletos');
        const updated = await context.updateAppointmentStatus(data.appointmentId, data.newStatus, AuditSource.N8N_WEBHOOK);
        
        // --- NOTIFICATION TRIGGER ---
        // Notify Secretary if patient cancelled via bot
        if (data.newStatus === AppointmentStatus.NAO_VEIO || data.newStatus === AppointmentStatus.BLOQUEADO) {
             await notificationService.notify({
                title: 'Cancelamento via Bot',
                message: `O agendamento de ${updated.patient?.name || 'Paciente'} foi alterado para ${data.newStatus} automaticamente.`,
                type: 'warning',
                clinicId: payload.clinicId,
                targetRole: [UserRole.SECRETARY, UserRole.DOCTOR_ADMIN],
                priority: 'medium',
                metadata: {
                    appointmentId: updated.id,
                    oldStatus: updated.status,
                    newStatus: data.newStatus
                }
            });
        }

        return { success: true, id: updated.id, message: `Status alterado para ${data.newStatus}` };
      }

      case 'BLOCK_SCHEDULE': {
        await context.createBatchAppointments([{
            clinicId: payload.clinicId,
            doctorId: data.doctorId,
            date: data.date,
            time: `${data.startHour} - ${data.endHour}`, // Symbolic
            status: AppointmentStatus.BLOQUEADO,
            notes: data.notes || 'Bloqueio via N8N'
        }], AuditSource.N8N_WEBHOOK);

        return { success: true, message: 'Bloqueio processado' };
      }

      case 'CREATE_PATIENT_CONTACT': {
         const patient = await context.getOrCreatePatient({
             name: data.patientName,
             phone: data.patientPhone,
             organizationId: payload.clinicId
         }, AuditSource.N8N_WEBHOOK);

         // Criar agendamento "EM_CONTATO" (Lead)
         const lead = await context.createAppointment({
            clinicId: payload.clinicId,
            doctorId: data.doctorId, // Pode ser null inicialmente
            patientId: patient.id,
            date: new Date().toISOString().split('T')[0], // Hoje
            time: '00:00', // Placeholder
            status: AppointmentStatus.EM_CONTATO,
            procedure: 'Lead WhatsApp',
            notes: data.message || 'Entrou em contato via WhatsApp'
         }, AuditSource.N8N_WEBHOOK);
         
         // --- NOTIFICATION TRIGGER ---
         await notificationService.notify({
            title: 'Novo Lead no WhatsApp',
            message: `${patient.name} iniciou uma conversa. Verifique o CRM.`,
            type: 'success',
            clinicId: payload.clinicId,
            targetRole: [UserRole.SECRETARY],
            priority: 'low',
            actionLink: 'view:Dashboard', // Vai para o CRM
            metadata: {
                appointmentId: lead.id,
                patientName: patient.name
            }
         });

         return { success: true, id: patient.id, message: 'Contato criado' };
      }

      default:
        throw new Error('Ação desconhecida');
    }
  }
};