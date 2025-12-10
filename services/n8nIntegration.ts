
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
import { systemLogService } from './auditService';
import { z } from 'zod';

// Crypto-safe Random ID Generator for Token
export const generateApiToken = (clinicId: string): string => {
  const timestamp = Date.now();
  // Use Crypto API for secure random values
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  const randomHex = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return `medflow_${clinicId}_${timestamp}_${randomHex}`;
};

/**
 * Constant-time comparison function to prevent timing attacks.
 * This ensures the comparison takes the same amount of time regardless 
 * of how many characters match.
 */
const timingSafeEqual = (a: string, b: string): boolean => {
    if (a.length !== b.length) {
        return false;
    }
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    return mismatch === 0;
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
  private readonly QUEUE_CHECK_INTERVAL = 10000; // Reduzido para 10s para maior responsividade
  private queueIntervalId: any = null;
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    // FIX: Process stale items immediately on load. 
    // This handles cases where items were scheduled for retry while the browser was closed.
    this.processQueue();
  }

  public start() {
    if (this.queueIntervalId) return;
    console.log('[N8N] Starting Webhook Queue Worker');
    this.processQueue(); // Run immediately on start
    this.queueIntervalId = setInterval(() => this.processQueue(), this.QUEUE_CHECK_INTERVAL);
  }

  public stop() {
    if (this.queueIntervalId) {
        clearInterval(this.queueIntervalId);
        this.queueIntervalId = null;
        console.log('[N8N] Stopped Webhook Queue Worker');
    }
  }

  private loadQueue() {
    this.queue = getStorage<WebhookQueueItem[]>(STORAGE_KEYS.WEBHOOK_QUEUE, []);
  }

  private saveQueue() {
    setStorage(STORAGE_KEYS.WEBHOOK_QUEUE, this.queue);
  }

  private addToQueue(url: string, payload: any, headers: any) {
    // CRITICAL: Reload queue to ensure we append to the latest state from other tabs
    this.loadQueue();

    const newItem: WebhookQueueItem = {
      id: crypto.randomUUID(), // Updated to secure ID
      url,
      payload,
      headers,
      retryCount: 0,
      nextRetry: Date.now(), // Retry immediately via worker
      createdAt: Date.now(),
      status: 'PENDING'
    };
    this.queue.push(newItem);
    this.saveQueue();
    monitoringService.trackMetric('webhook_queue_size', this.queue.length);
    
    // Trigger processing immediately so we don't wait for the next interval
    this.processQueue();
  }

  private calculateBackoff(retryCount: number): number {
    const baseDelay = Math.pow(2, retryCount + 1) * 1000; 
    const jitter = Math.random() * 500;
    return baseDelay + jitter;
  }

  private async processQueue() {
    // 1. Prevent local re-entry overlap
    if (this.isProcessing) return;

    // 2. Cross-Tab Locking using Web Locks API
    // This ensures that only ONE tab across the entire browser processes the queue at a time.
    // 'ifAvailable: true' means if lock is busy (another tab working), we just return and try next interval.
    // This prevents duplication and race conditions cleanly.
    
    const lockManager = (navigator as any).locks;

    const runQueueLogic = async () => {
        this.isProcessing = true;
        try {
            // 3. CRITICAL: Reload from storage to see items added by other tabs
            this.loadQueue();
            
            const now = Date.now();
            const pendingItems = this.queue.filter(item => item.nextRetry <= now && item.status !== 'FAILED');

            if (pendingItems.length === 0) return;

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

                // Success: Remove from queue
                // We filter based on ID to be safe even if list changed slightly (though lock prevents concurrent writes)
                this.queue = this.queue.filter(q => q.id !== item.id);
                this.saveQueue();
                monitoringService.trackMetric('webhook_worker_success', 1, { url: item.url });

              } catch (error) {
                // Failure: Update retry count and backoff
                monitoringService.trackError(error as Error, { source: 'WebhookWorker', itemId: item.id });

                const index = this.queue.findIndex(q => q.id === item.id);
                if (index !== -1) {
                  const updatedItem = this.queue[index];
                  updatedItem.retryCount += 1;
                  
                  if (updatedItem.retryCount >= this.MAX_RETRIES) {
                    // PERMANENT FAILURE
                    updatedItem.status = 'FAILED';
                    
                    // 1. Remove from Active Queue immediately to save space (Storage Protection)
                    // The audit log becomes the permanent record.
                    this.queue.splice(index, 1);
                    this.saveQueue();

                    // 2. Persist to Audit Log for visibility
                    // Using fire-and-forget logic to not block the loop, but catching errors
                    const clinicId = updatedItem.payload?.data?.clinicId || 'unknown_org';
                    
                    systemLogService.createLog({
                        organizationId: clinicId,
                        action: AuditAction.WEBHOOK_FAILURE,
                        entityType: 'Webhook',
                        entityId: item.id,
                        description: `Webhook failed after ${this.MAX_RETRIES} retries: ${item.url}`,
                        metadata: {
                            url: item.url,
                            payload: item.payload,
                            error: (error as Error).message
                        },
                        source: AuditSource.SYSTEM,
                        userId: 'system',
                        userName: 'Webhook Worker'
                    }).catch(e => console.error("Failed to log webhook failure", e));

                    monitoringService.trackEvent('webhook_permanent_failure', { itemId: item.id, url: item.url });
                  } else {
                    // RETRY
                    updatedItem.nextRetry = Date.now() + this.calculateBackoff(updatedItem.retryCount);
                    this.queue[index] = updatedItem;
                    this.saveQueue();
                  }
                }
              }
            }
        } catch (e) {
            console.error('[WebhookWorker] Error processing queue', e);
        } finally {
            this.isProcessing = false;
        }
    };

    if (lockManager) {
        // Request lock named 'medflow_webhook_worker'. 
        // ifAvailable: true makes it non-blocking (returns null if locked).
        await lockManager.request('medflow_webhook_worker', { ifAvailable: true }, async (lock: any) => {
            if (lock) {
                await runQueueLogic();
            }
            // else: another tab is processing, we skip this tick.
        });
    } else {
        // Fallback for very old browsers (rare)
        await runQueueLogic();
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

    const startTime = performance.now();

    try {
        // Attempt immediate delivery
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

    } catch (error) {
        // High Reliability: On ANY failure, immediately persist to queue.
        console.warn('[N8N] Webhook failed, queuing for retry', error);
        monitoringService.trackMetric('webhook_outbound_failure_queued', 1, { event: payload.event });
        this.addToQueue(settings.n8nWebhookUrl, payload, headers);
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

    // FIX: Await the async checkLimit (it now returns a Promise)
    const isAllowed = await rateLimiterService.checkLimit(clinicId);
    if (!isAllowed) {
        throw new Error('RATE_LIMIT_EXCEEDED: Muitas requisições em curto período.');
    }

    try {
        const expectedToken = validTokens.get(clinicId);
        
        // --- SECURITY ENHANCEMENT: Explicit Failure Logging ---
        if (!expectedToken) {
            await systemLogService.createLog({
                organizationId: clinicId,
                action: AuditAction.SECURITY_VIOLATION,
                entityType: 'Webhook',
                entityId: 'security_config',
                description: `Webhook rejected: No valid token configured for clinic ${clinicId}`,
                source: AuditSource.N8N_WEBHOOK,
                userId: 'system',
                userName: 'System Security'
            });
            throw new Error('SECURITY: Invalid clinic configuration - Token not found.');
        }

        const receivedToken = rawPayload.authToken || '';
        // Use timingSafeEqual instead of direct comparison
        if (!timingSafeEqual(receivedToken, expectedToken)) {
             await systemLogService.createLog({
                organizationId: clinicId,
                action: AuditAction.SECURITY_VIOLATION,
                entityType: 'Webhook',
                entityId: 'security_auth',
                description: `Webhook rejected: Invalid token received`,
                // Safely log only first 8 chars of received token to aid debug without leaking full credential
                metadata: { receivedTokenPrefix: receivedToken.substring(0, 8) + '...' },
                source: AuditSource.N8N_WEBHOOK,
                userId: 'system',
                userName: 'System Security'
            });
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
