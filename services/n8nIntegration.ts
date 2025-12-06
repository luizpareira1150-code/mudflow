
import { ClinicSettings, AppointmentStatus, AuditAction, AuditSource, UserRole, WebhookQueueItem } from '../types';
import { N8NWebhookSchema } from '../utils/validationSchemas';
import { validateSafe } from '../utils/validator';
import { notificationService } from './notificationService';
import { slotReservationService } from './slotReservationService';
import { recommendationService } from './recommendationService';
import { doctorAvailabilityService } from './doctorAvailabilityService';
import { rateLimiterService } from './rateLimiterService';
import { STORAGE_KEYS, getStorage, setStorage } from './storage';
import { monitoringService } from './monitoring';
import { z } from 'zod';

export const generateApiToken = (clinicId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `medflow_${clinicId}_${timestamp}_${random}`;
};

export interface N8NOutgoingPayload {
  event: 'APPOINTMENT_CREATED' | 'STATUS_CHANGED' | 'AGENDA_BLOCKED' | 'DOCTOR_CREATED' | 'DOCTOR_UPDATED' | 'DOCTOR_DELETED' | 'PASSWORD_RECOVERY';
  data: {
    appointmentId?: string;
    patientName?: string;
    patientPhone?: string;
    date?: string;
    time?: string;
    status?: string;
    oldStatus?: string;
    procedure?: string;
    notes?: string;
    doctorId?: string;
    doctorName?: string;
    clinicId: string;
    [key: string]: any;
  };
  context?: {
    doctor?: {
      id: string;
      name: string;
      specialty: string;
      phone?: string;
    };
    organization?: {
      id: string;
      name: string;
      type: string;
    };
    evolution?: {
      instanceName?: string;
      baseUrl?: string;
    };
    system?: {
      timestamp: string;
      timezone: string;
      env: string;
    };
  };
}

class N8NIntegrationServiceClass {
  private queue: WebhookQueueItem[] = [];
  private readonly MAX_RETRIES = 5;
  private readonly QUEUE_CHECK_INTERVAL = 30000; 

  constructor() {
    this.loadQueue();
    setInterval(() => this.processQueue(), this.QUEUE_CHECK_INTERVAL);
  }

  private loadQueue() {
    this.queue = getStorage<WebhookQueueItem[]>(STORAGE_KEYS.WEBHOOK_QUEUE, []);
  }

  private saveQueue() {
    setStorage(STORAGE_KEYS.WEBHOOK_QUEUE, this.queue);
  }

  private addToQueue(url: string, payload: any, headers: any) {
    const newItem: WebhookQueueItem = {
      id: Math.random().toString(36).substr(2, 9),
      url,
      payload,
      headers,
      retryCount: 0,
      nextRetry: Date.now(),
      createdAt: Date.now(),
      status: 'PENDING'
    };
    this.queue.push(newItem);
    this.saveQueue();
    monitoringService.trackMetric('webhook_queue_size', this.queue.length);
  }

  private calculateBackoff(retryCount: number): number {
    const baseDelay = Math.pow(2, retryCount + 1) * 1000; 
    const jitter = Math.random() * 500;
    return baseDelay + jitter;
  }

  private async processQueue() {
    if (this.queue.length === 0) return;

    const now = Date.now();
    const pendingItems = this.queue.filter(item => item.nextRetry <= now && item.status !== 'FAILED');

    for (const item of pendingItems) {
      try {
        const response = await fetch(item.url, {
          method: 'POST',
          headers: item.headers,
          body: JSON.stringify(item.payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        this.queue = this.queue.filter(q => q.id !== item.id);
        this.saveQueue();
        monitoringService.trackMetric('webhook_worker_success', 1, { url: item.url });

      } catch (error) {
        monitoringService.trackError(error as Error, { source: 'WebhookWorker', itemId: item.id });

        const index = this.queue.findIndex(q => q.id === item.id);
        if (index !== -1) {
          const updatedItem = this.queue[index];
          updatedItem.retryCount += 1;
          
          if (updatedItem.retryCount >= this.MAX_RETRIES) {
            updatedItem.status = 'FAILED';
            monitoringService.trackEvent('webhook_permanent_failure', { itemId: item.id, url: item.url });
          } else {
            updatedItem.nextRetry = Date.now() + this.calculateBackoff(updatedItem.retryCount);
          }
          this.queue[index] = updatedItem;
          this.saveQueue();
        }
      }
    }
  }

  public async sendToN8N(payload: N8NOutgoingPayload, settings: ClinicSettings) {
    if (!settings.n8nWebhookUrl) return;

    if (!settings.n8nProductionMode) {
      console.group('🚀 [N8N Simulation] Webhook Triggered');
      console.log('Target URL:', settings.n8nWebhookUrl);
      console.log('Data:', payload.data);
      console.groupEnd();
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Clinic-Token': settings.clinicToken || '',
      'X-Api-Token': settings.apiToken || '',
      'X-Event-Type': payload.event,
      'X-Evolution-Instance': payload.context?.evolution?.instanceName || ''
    };

    let attempts = 0;
    const IMMEDIATE_RETRIES = 2;
    const startTime = performance.now();

    while (attempts <= IMMEDIATE_RETRIES) {
      try {
        const response = await fetch(settings.n8nWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`N8N responded with ${response.status}`);
        }
        
        const duration = performance.now() - startTime;
        monitoringService.trackMetric('webhook_outbound_latency', duration, { event: payload.event });
        return; 

      } catch (error) {
        attempts++;
        if (attempts <= IMMEDIATE_RETRIES) {
          const delay = 1000 * attempts;
          await new Promise(r => setTimeout(r, delay));
        } else {
          monitoringService.trackMetric('webhook_outbound_failure_queued', 1, { event: payload.event });
          this.addToQueue(settings.n8nWebhookUrl, payload, headers);
        }
      }
    }
  }

  public async receiveFromN8N(
    rawPayload: any, 
    validTokens: Map<string, string>,
    context: any
  ) {
    const startTime = performance.now();

    // Basic structure check before Zod (for rate limiting logic)
    const clinicId = rawPayload.clinicId;
    if (!clinicId) throw new Error('Clinic ID missing in payload');

    if (!rateLimiterService.checkLimit(clinicId)) {
        throw new Error('RATE_LIMIT_EXCEEDED: Muitas requisições em curto período.');
    }

    try {
        const expectedToken = validTokens.get(clinicId);
        if (!expectedToken || rawPayload.authToken !== expectedToken) {
          throw new Error('Acesso Negado: Token de autenticação inválido.');
        }

        // --- VALIDAÇÃO ESTRITA (TYPE SAFE) ---
        // Zod agora garante que se action="UPDATE_STATUS", data tem appointmentId
        const validation = N8NWebhookSchema.safeParse(rawPayload);
        
        if (!validation.success) {
            console.error("Webhook Validation Failed:", validation.error.format());
            throw new Error(`Payload Inválido: ${validation.error.errors[0]?.message}`);
        }

        // O TypeScript agora infere o tipo correto automaticamente baseado no discriminator 'action'
        const payload = validation.data;
        const { action, data } = payload;

        switch (action) {
          case 'GET_SLOT_SUGGESTIONS': {
            // 1. Encontrar paciente pelo telefone (vindo do WhatsApp)
            const patients = await context.searchPatients(data.patientPhone, clinicId);
            const patient = patients[0]; 
            
            // Se paciente não existe, não há histórico para analisar
            if (!patient) {
                return { 
                    success: false, 
                    message: 'Paciente não encontrado para gerar histórico.', 
                    suggestions: [] 
                };
            }

            // 2. Chamar o motor de recomendação
            // O context.dataService inclui o recommendationService (ou importamos direto se mock)
            // Aqui usamos recommendationService importado diretamente para garantir acesso
            const suggestions = await recommendationService.suggestOptimalSlots(clinicId, data.doctorId, patient.id);
            
            return {
                success: true,
                patientName: patient.name,
                // Mapeamos para um formato simples que o ChatGPT entenda fácil
                suggestions: suggestions.map((s: any) => ({
                    date: s.slot.date, // "2023-10-05"
                    time: s.slot.time, // "09:00"
                    score: s.score,    // 50 (ChatGPT pode usar para priorizar)
                    reason: s.reason   // "Costuma vir às terças"
                }))
            };
          }

          case 'CREATE_APPOINTMENT': {
            // TypeScript knows 'data' has date, time, doctorId
            const availabilityCheck = await doctorAvailabilityService.validateAvailability( 
                data.doctorId, 
                clinicId, 
                data.date, 
                data.time 
            );

            if (!availabilityCheck.isAvailable) { 
                throw new Error(`AVAILABILITY_ERROR:${availabilityCheck.reason}`);
            }

            let reservationId: string | undefined;
            let retryCount = 0;
            const MAX_RETRIES = 3;
            
            while (retryCount < MAX_RETRIES) {
              try {
                const reservationResult = await context.slotReservationService.reserveSlot({
                  doctorId: data.doctorId,
                  date: data.date,
                  time: data.time,
                  clinicId: clinicId,
                  reservedBy: 'N8N_WEBHOOK'
                });
                
                if (!reservationResult.success) {
                  retryCount++;
                  if (retryCount >= MAX_RETRIES) throw new Error('CONFLICT_MAX_RETRIES');
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                  continue;
                }
                
                reservationId = reservationResult.reservation!.id;
                
                const patient = await context.getOrCreatePatient({
                  name: data.patientName || 'Via WhatsApp',
                  phone: data.patientPhone || '',
                  cpf: data.patientCPF,
                  organizationId: clinicId
                }, AuditSource.N8N_WEBHOOK);

                const appt = await context.createAppointment({
                  clinicId: clinicId,
                  doctorId: data.doctorId,
                  patientId: patient.id,
                  date: data.date,
                  time: data.time,
                  status: AppointmentStatus.AGENDADO,
                  procedure: data.procedure || 'Bot',
                  notes: data.notes || ''
                }, AuditSource.N8N_WEBHOOK, reservationId);

                return { success: true, id: appt.id, message: 'Agendado' };
                
              } catch (error: any) {
                if (reservationId) await context.slotReservationService.cancelReservation(reservationId);
                throw error;
              }
            }
            throw new Error('Falha ao agendar');
          }

          case 'UPDATE_STATUS': {
            // TypeScript knows 'data' has appointmentId and newStatus
            const updated = await context.updateAppointmentStatus(data.appointmentId, data.newStatus, AuditSource.N8N_WEBHOOK);
            return { success: true, id: updated.id, message: 'Status atualizado' };
          }

          case 'MOVE_TO_HUMAN_ATTENDANCE': {
            // TypeScript knows 'data' has appointmentId
            await context.updateAppointmentStatus(data.appointmentId, AppointmentStatus.ATENDIMENTO_HUMANO, AuditSource.N8N_WEBHOOK);
            
            await notificationService.notify({
                title: 'Atendimento Humano Necessário',
                message: `${data.patientName || 'Paciente'} solicita ajuda.`,
                type: 'warning',
                priority: 'high',
                clinicId: clinicId,
                targetRole: [UserRole.SECRETARY],
                metadata: { 
                    appointmentId: data.appointmentId, 
                    patientPhone: data.patientPhone,
                    triggerPopup: true 
                }
            });
            return { success: true };
          }

          case 'DETECT_HUMAN_INTERVENTION': {
            // TypeScript knows 'data' has appointmentId
            await context.updateAppointmentStatus(data.appointmentId, AppointmentStatus.ATENDIMENTO_HUMANO, AuditSource.N8N_WEBHOOK);

            await notificationService.notify({
                title: 'Bot Pausado',
                message: `Intervenção detectada em ${data.patientName || 'conversa'}.`,
                type: 'info',
                priority: 'low',
                clinicId: clinicId,
                targetRole: [UserRole.SECRETARY],
                metadata: { appointmentId: data.appointmentId, triggerPopup: false }
            });
            return { success: true };
          }

          case 'BLOCK_SCHEDULE': {
            // TypeScript knows 'data' has startHour, endHour, etc.
            await context.createBatchAppointments([{
                clinicId: clinicId,
                doctorId: data.doctorId,
                date: data.date,
                time: `${data.startHour} - ${data.endHour}`,
                status: AppointmentStatus.BLOQUEADO,
                notes: data.notes || 'Bloqueio N8N'
            }], AuditSource.N8N_WEBHOOK);
            return { success: true };
          }

          case 'CREATE_PATIENT_CONTACT': {
            const patient = await context.getOrCreatePatient({
                name: data.patientName,
                phone: data.patientPhone,
                organizationId: clinicId
            }, AuditSource.N8N_WEBHOOK);

            const lead = await context.createAppointment({
                clinicId: clinicId,
                doctorId: data.doctorId, 
                patientId: patient.id,
                date: new Date().toISOString().split('T')[0], 
                time: '00:00',
                status: AppointmentStatus.EM_CONTATO,
                procedure: 'Lead WhatsApp',
                notes: data.message || ''
            }, AuditSource.N8N_WEBHOOK);
            
            await notificationService.notify({
                title: 'Novo Lead',
                message: `${patient.name} iniciou contato.`,
                type: 'success',
                clinicId: clinicId,
                targetRole: [UserRole.SECRETARY],
                priority: 'low'
            });

            return { success: true, id: patient.id };
          }

          default:
            const _exhaustiveCheck: never = action as never;
            throw new Error(`Ação não suportada: ${_exhaustiveCheck}`);
        }
    } catch (error: any) {
        const duration = performance.now() - startTime;
        // Safe access to action if possible
        const actionName = rawPayload?.action || 'UNKNOWN';
        monitoringService.trackMetric('webhook_inbound_latency', duration, { action: actionName, status: 'error' });
        monitoringService.trackError(error, { source: 'WebhookInbound', payload: rawPayload });
        throw error;
    } finally {
        const duration = performance.now() - startTime;
        const actionName = rawPayload?.action || 'UNKNOWN';
        monitoringService.trackMetric('webhook_inbound_latency', duration, { action: actionName });
    }
  }
}

export const N8NIntegrationService = new N8NIntegrationServiceClass();
