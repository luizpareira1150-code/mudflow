
import { ClinicSettings, AppointmentStatus, AuditAction, AuditSource, UserRole, WebhookQueueItem } from '../types';
import { N8NWebhookSchema } from '../utils/validationSchemas';
import { validateSafe } from '../utils/validator';
import { notificationService } from './notificationService';
import { slotReservationService } from './slotReservationService';
import { recommendationService } from './recommendationService';
import { doctorAvailabilityService } from './doctorAvailabilityService';
import { rateLimiterService } from './rateLimiterService';
import { STORAGE_KEYS, getStorage, setStorage } from './storage';

// Gera token único para cada clínica
export const generateApiToken = (clinicId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `medflow_${clinicId}_${timestamp}_${random}`;
};

// Interface para payloads enriquecidos enviados AO N8N
export interface N8NOutgoingPayload {
  event: 'APPOINTMENT_CREATED' | 'STATUS_CHANGED' | 'AGENDA_BLOCKED' | 'DOCTOR_CREATED' | 'DOCTOR_UPDATED' | 'DOCTOR_DELETED' | 'PASSWORD_RECOVERY';
  data: {
    // Appointment Core Data
    appointmentId?: string;
    patientName?: string;
    patientPhone?: string;
    date?: string;
    time?: string;
    status?: string;
    oldStatus?: string;
    procedure?: string;
    notes?: string;
    
    // Legacy support fields
    doctorId?: string;
    doctorName?: string;
    clinicId: string;
    
    // Additional generic data
    [key: string]: any;
  };
  // RICH CONTEXT: Dados pré-carregados para facilitar a vida no N8N
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
      apiKey?: string; // CUIDADO: Em produção real, enviar via Header. Aqui facilitamos para o N8N.
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
  private readonly QUEUE_CHECK_INTERVAL = 30000; // 30 segundos

  constructor() {
    this.loadQueue();
    // Iniciar worker de processamento da fila
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
      nextRetry: Date.now(), // Pronto para tentar
      createdAt: Date.now(),
      status: 'PENDING'
    };
    this.queue.push(newItem);
    this.saveQueue();
    console.log(`[QUEUE] Webhook adicionado à fila persistente: ${newItem.id}`);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential Backoff: 2s, 4s, 8s, 16s, 32s + Jitter
    const baseDelay = Math.pow(2, retryCount + 1) * 1000; 
    const jitter = Math.random() * 500; // Até 500ms de aleatoriedade
    return baseDelay + jitter;
  }

  private async processQueue() {
    if (this.queue.length === 0) return;

    const now = Date.now();
    const pendingItems = this.queue.filter(item => item.nextRetry <= now && item.status !== 'FAILED');

    if (pendingItems.length > 0) {
      console.log(`[WORKER] Processando ${pendingItems.length} webhooks pendentes...`);
    }

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

        // Sucesso: Remover da fila
        this.queue = this.queue.filter(q => q.id !== item.id);
        this.saveQueue();
        console.log(`[WORKER] Webhook ${item.id} enviado com sucesso!`);

      } catch (error) {
        console.warn(`[WORKER] Falha ao enviar ${item.id}. Tentativa ${item.retryCount + 1}/${this.MAX_RETRIES}`);
        
        // Atualizar item na fila
        const index = this.queue.findIndex(q => q.id === item.id);
        if (index !== -1) {
          const updatedItem = this.queue[index];
          updatedItem.retryCount += 1;
          
          if (updatedItem.retryCount >= this.MAX_RETRIES) {
            updatedItem.status = 'FAILED';
            console.error(`[WORKER] Webhook ${item.id} falhou definitivamente após ${this.MAX_RETRIES} tentativas.`);
            // Opcional: Notificar admin ou mover para Dead Letter Queue
          } else {
            updatedItem.nextRetry = Date.now() + this.calculateBackoff(updatedItem.retryCount);
          }
          this.queue[index] = updatedItem;
          this.saveQueue();
        }
      }
    }
  }

  // Envia dados para o N8N (Outbound) com Retry Logic Híbrido
  public async sendToN8N(payload: N8NOutgoingPayload, settings: ClinicSettings) {
    if (!settings.n8nWebhookUrl) return;

    // Se não estiver em modo produção, apenas loga
    if (!settings.n8nProductionMode) {
      console.group('🚀 [N8N Simulation] Webhook Triggered (Rich Context)');
      console.log('Target URL:', settings.n8nWebhookUrl);
      console.log('Event:', payload.event);
      console.log('Core Data:', payload.data);
      console.log('Enriched Context:', payload.context);
      console.groupEnd();
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Clinic-Token': settings.clinicToken || '',
      'X-Api-Token': settings.apiToken || '',
      // Headers auxiliares para o N8N identificar origem rapidamente
      'X-Event-Type': payload.event,
      'X-Evolution-Instance': payload.context?.evolution?.instanceName || ''
    };

    // Tentar envio imediato com retentativa rápida em memória (Fast Failover)
    // Se falhar tudo, joga pra fila persistente (Reliability)
    let attempts = 0;
    const IMMEDIATE_RETRIES = 2; // Tenta 2x na hora

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
        
        return; // Sucesso imediato

      } catch (error) {
        attempts++;
        if (attempts <= IMMEDIATE_RETRIES) {
          const delay = 1000 * attempts; // 1s, 2s
          console.warn(`[WEBHOOK] Falha temporária. Retentando em ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          // Falhou todas as tentativas imediatas -> Salvar na fila persistente
          console.error(`[WEBHOOK] Falha na entrega imediata. Salvando na fila para retry em background.`);
          this.addToQueue(settings.n8nWebhookUrl, payload, headers);
        }
      }
    }
  }

  // Recebe dados do N8N (Inbound Simulation)
  public async receiveFromN8N(
    payload: { action: string; data: any; clinicId: string; authToken: string }, 
    validTokens: Map<string, string>,
    context: any // Injected DataService to avoid circular dependencies
  ) {
    
    // 0. RATE LIMITING (Proteção contra Abuse/DDoS)
    if (!rateLimiterService.checkLimit(payload.clinicId)) {
        console.warn(`[RATE LIMIT] Bloqueado excesso de requisições para clínica ${payload.clinicId}`);
        throw new Error('RATE_LIMIT_EXCEEDED: Muitas requisições em curto período. Tente novamente em alguns segundos.');
    }

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
      case 'GET_SLOT_SUGGESTIONS': {
        if (!data.doctorId || !data.patientPhone) {
             throw new Error('Dados insuficientes: doctorId e patientPhone são obrigatórios para sugestão.');
        }

        const patients = await context.searchPatients(data.patientPhone, payload.clinicId);
        const patient = patients[0]; 

        if (!patient) {
            return { 
                success: false, 
                message: 'Paciente não encontrado para histórico.', 
                suggestions: [] 
            };
        }

        const suggestions = await recommendationService.suggestOptimalSlots(
            payload.clinicId,
            data.doctorId,
            patient.id
        );

        return {
            success: true,
            patientName: patient.name,
            suggestions: suggestions.map((s: any) => ({
                date: s.slot.date,
                time: s.slot.time,
                score: s.score,
                reason: s.reason 
            }))
        };
      }

      case 'CREATE_APPOINTMENT': {
        // VALIDAR DISPONIBILIDADE ANTES DE TENTAR RESERVAR 
        const availabilityCheck = await doctorAvailabilityService.validateAvailability( 
            data.doctorId, 
            payload.clinicId, 
            data.date, 
            data.time 
        );

        if (!availabilityCheck.isAvailable) { 
            const suggestionsText = availabilityCheck.suggestedDates && availabilityCheck.suggestedDates.length > 0 
                ? `\n\nSugestões: ${availabilityCheck.suggestedDates.map((d: string) => new Date(d).toLocaleDateString('pt-BR')).join(', ')}` 
                : '';

            throw new Error(`AVAILABILITY_ERROR:${availabilityCheck.reason}${suggestionsText}`);
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
              clinicId: payload.clinicId,
              reservedBy: 'N8N_WEBHOOK'
            });
            
            if (!reservationResult.success) {
              console.warn(`[N8N RETRY ${retryCount + 1}] Conflito detectado`);
              retryCount++;
              if (retryCount >= MAX_RETRIES) {
                throw new Error('CONFLICT_MAX_RETRIES:Não foi possível agendar após múltiplas tentativas.');
              }
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
              continue;
            }
            
            reservationId = reservationResult.reservation!.id;
            
            const patient = await context.getOrCreatePatient({
              name: data.patientName || 'Paciente (Via WhatsApp)',
              phone: data.patientPhone || '',
              cpf: data.patientCPF,
              organizationId: payload.clinicId
            }, AuditSource.N8N_WEBHOOK);

            const appt = await context.createAppointment({
              clinicId: payload.clinicId,
              doctorId: data.doctorId,
              patientId: patient.id,
              date: data.date,
              time: data.time,
              status: AppointmentStatus.AGENDADO,
              procedure: data.procedure || 'Agendamento via Bot',
              notes: data.notes
            }, AuditSource.N8N_WEBHOOK, reservationId);

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
                source: 'WhatsApp Bot',
                hadConflicts: retryCount > 0
              }
            });

            return { success: true, id: appt.id, message: 'Agendamento criado via N8N', retries: retryCount };
            
          } catch (error: any) {
            if (reservationId) {
              await context.slotReservationService.cancelReservation(reservationId);
            }
            if (error.message?.includes('CONFLICT_MAX_RETRIES')) {
              await context.logEvent({
                organizationId: payload.clinicId,
                action: AuditAction.APPOINTMENT_CREATED,
                entityType: 'Appointment',
                entityId: 'conflict_unresolved',
                entityName: 'N8N CONFLICT',
                description: `N8N falhou após ${retryCount} tentativas: ${data.date} ${data.time}`,
                metadata: { retries: retryCount, source: 'N8N_WEBHOOK', patientName: data.patientName }
              });
              throw error;
            }
            throw error;
          }
        }
        throw new Error('Falha inesperada no loop de retry');
      }

      case 'UPDATE_STATUS': {
        if (!data.appointmentId || !data.newStatus) throw new Error('Dados incompletos');
        const updated = await context.updateAppointmentStatus(data.appointmentId, data.newStatus, AuditSource.N8N_WEBHOOK);
        
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
            time: `${data.startHour} - ${data.endHour}`,
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

         const lead = await context.createAppointment({
            clinicId: payload.clinicId,
            doctorId: data.doctorId, 
            patientId: patient.id,
            date: new Date().toISOString().split('T')[0], 
            time: '00:00',
            status: AppointmentStatus.EM_CONTATO,
            procedure: 'Lead WhatsApp',
            notes: data.message || 'Entrou em contato via WhatsApp'
         }, AuditSource.N8N_WEBHOOK);
         
         await notificationService.notify({
            title: 'Novo Lead no WhatsApp',
            message: `${patient.name} iniciou uma conversa. Verifique o CRM.`,
            type: 'success',
            clinicId: payload.clinicId,
            targetRole: [UserRole.SECRETARY],
            priority: 'low',
            actionLink: 'view:Dashboard',
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
}

export const N8NIntegrationService = new N8NIntegrationServiceClass();
