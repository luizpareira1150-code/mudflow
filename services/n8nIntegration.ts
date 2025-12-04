

import { ClinicSettings, AppointmentStatus } from '../types';

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
    requestTime?: string;
  };
  
  // Contexto completo para N8N processar
  context: {
    evolutionApi: {
      instanceName: string;
      apiKey: string;
      baseUrl?: string;
    };
    clinic: {
      id: string;
      name: string;
      timezone: string;
    };
    doctor: {
      id: string;
      name: string;
      specialty: string;
    };
    timestamp: string;
  };
}

// Interface para payloads RECEBIDOS do N8N
export interface N8NIncomingPayload {
  action: 'CREATE_APPOINTMENT' | 'UPDATE_STATUS' | 'BLOCK_SCHEDULE' | 'CREATE_PATIENT_CONTACT';
  authToken: string; // Token de segurança da clínica
  clinicId: string;
  
  // Dados específicos por ação
  data: {
    // Para CREATE_APPOINTMENT
    doctorId?: string;
    patientName?: string;
    patientPhone?: string;
    date?: string;
    time?: string;
    procedure?: string;
    notes?: string;
    
    // Para UPDATE_STATUS
    appointmentId?: string;
    newStatus?: string;
    
    // Para BLOCK_SCHEDULE
    startHour?: string;
    endHour?: string;
    
    // Para CREATE_PATIENT_CONTACT
    source?: 'whatsapp' | 'phone' | 'website';
    message?: string;
  };
}

// Serviço de Integração N8N
export class N8NIntegrationService {
  
  // ============================================================
  // ENVIAR DADOS PARA N8N (Sistema → N8N)
  // ============================================================
  
  static async sendToN8N(
    payload: N8NOutgoingPayload,
    settings: ClinicSettings
  ): Promise<boolean> {
    
    // Validação: Webhook configurado?
    if (!settings.n8nWebhookUrl) {
      console.warn('[N8N] Webhook não configurado para esta clínica.');
      return false;
    }
    
    // Validação: Evolution API configurada?
    if (!settings.evolutionInstanceName || !settings.evolutionApiKey) {
      console.warn('[N8N] Evolution API não configurada. Algumas automações podem falhar.');
    }
    
    // Log colorido no console (ambiente de desenvolvimento)
    console.group(`🚀 [N8N] Enviando Webhook`);
    console.log(`%c📍 URL: ${settings.n8nWebhookUrl}`, 'color: #8b5cf6; font-weight: bold');
    console.log(`%c📦 Evento: ${payload.event}`, 'color: #3b82f6; font-weight: bold');
    console.log(`%c👤 Paciente: ${payload.data.patientName || 'N/A'}`, 'color: #10b981');
    console.log(`%c🩺 Médico: ${payload.context.doctor.name}`, 'color: #06b6d4');
    console.log(`%c📱 Evolution Instance: ${payload.context.evolutionApi.instanceName}`, 'color: #f59e0b');
    console.table({
      'Clinic ID': payload.context.clinic.id,
      'Clinic Name': payload.context.clinic.name,
      'Timestamp': payload.context.timestamp,
      'Has Evolution Key': !!payload.context.evolutionApi.apiKey
    });
    console.groupEnd();
    
    try {
      // ✅ DECISÃO BASEADA EM CONFIGURAÇÃO
      if (!settings.n8nProductionMode) {
        // Modo DESENVOLVIMENTO: Apenas simula
        console.log('%c🧪 [DEV MODE] Webhook simulado - não foi enviado', 'color: #f59e0b; font-weight: bold; font-size: 12px;');
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
      }
      
      // Modo PRODUÇÃO: Envia de verdade
      console.log('%c🚀 [PROD MODE] Enviando webhook real...', 'color: #10b981; font-weight: bold; font-size: 12px;');
      
      const response = await fetch(settings.n8nWebhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MedFlow/1.0'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log('%c✅ Webhook enviado com sucesso!', 'color: #10b981; font-weight: bold;');
        return true;
      } else {
        console.error(`❌ Erro HTTP ${response.status}: ${response.statusText}`);
        return false;
      }
      
    } catch (error) {
      console.error('[N8N] Erro ao enviar webhook:', error);
      return false;
    }
  }
  
  // ============================================================
  // RECEBER DADOS DO N8N (N8N → Sistema)
  // ============================================================
  
  static async receiveFromN8N(
    payload: N8NIncomingPayload,
    validTokens: Map<string, string>, // Map<clinicId, token>
    dataService: any // Dependency Injection to avoid circular imports
  ): Promise<{ success: boolean; message: string; data?: any }> {
    
    console.group(`📥 [N8N] Webhook Recebido`);
    console.log(`%c🔐 Validando autenticação...`, 'color: #f59e0b; font-weight: bold');
    
    // 1. Validação de Segurança
    const expectedToken = validTokens.get(payload.clinicId);
    
    if (!expectedToken) {
      console.error(`❌ Clínica ${payload.clinicId} não encontrada`);
      console.groupEnd();
      return { success: false, message: 'Clínica não encontrada' };
    }
    
    if (payload.authToken !== expectedToken) {
      console.error(`❌ Token inválido para clínica ${payload.clinicId}`);
      console.groupEnd();
      return { success: false, message: 'Token de autenticação inválido' };
    }
    
    console.log(`%c✅ Autenticação válida`, 'color: #10b981; font-weight: bold');
    console.log(`%c🎯 Ação: ${payload.action}`, 'color: #3b82f6; font-weight: bold');
    
    // 2. Roteamento de Ação
    try {
      let result;
      
      switch (payload.action) {
        case 'CREATE_APPOINTMENT':
          result = await this.handleCreateAppointment(payload, dataService);
          break;
          
        case 'UPDATE_STATUS':
          result = await this.handleUpdateStatus(payload, dataService);
          break;
          
        case 'BLOCK_SCHEDULE':
          result = await this.handleBlockSchedule(payload, dataService);
          break;
          
        case 'CREATE_PATIENT_CONTACT':
          result = await this.handleCreateContact(payload, dataService);
          break;
          
        default:
          console.error(`❌ Ação desconhecida: ${payload.action}`);
          console.groupEnd();
          return { success: false, message: 'Ação não reconhecida' };
      }
      
      console.log(`%c✅ Ação processada com sucesso`, 'color: #10b981; font-weight: bold');
      console.groupEnd();
      return result;
      
    } catch (error: any) {
      console.error(`❌ Erro ao processar ação:`, error);
      console.groupEnd();
      return { success: false, message: error.message || 'Erro interno' };
    }
  }
  
  // ============================================================
  // HANDLERS DE AÇÕES (chamados pelo N8N)
  // ============================================================
  
  private static async handleCreateAppointment(payload: N8NIncomingPayload, dataService: any) {
    const { doctorId, patientName, patientPhone, date, time, procedure, notes } = payload.data;
    
    // Validações
    if (!doctorId || !patientName || !patientPhone || !date || !time) {
      return { success: false, message: 'Dados obrigatórios ausentes' };
    }
    
    console.log(`📝 Criando agendamento para ${patientName} em ${date} às ${time}`);
    
    const appt = await dataService.createAppointment({
      clinicId: payload.clinicId,
      doctorId: doctorId,
      patientId: `ext_${Date.now()}`,
      patientName,
      patientPhone,
      date,
      time,
      procedure: procedure || 'Agendamento Externo',
      notes,
      status: AppointmentStatus.AGENDADO
    });
    
    return {
      success: true,
      message: 'Agendamento criado com sucesso',
      data: { appointmentId: appt.id }
    };
  }
  
  private static async handleUpdateStatus(payload: N8NIncomingPayload, dataService: any) {
    const { appointmentId, newStatus } = payload.data;
    
    if (!appointmentId || !newStatus) {
      return { success: false, message: 'appointmentId e newStatus são obrigatórios' };
    }
    
    console.log(`📝 Atualizando status do agendamento ${appointmentId} para ${newStatus}`);
    
    await dataService.updateAppointmentStatus(appointmentId, newStatus as AppointmentStatus);
    
    return {
      success: true,
      message: 'Status atualizado com sucesso'
    };
  }
  
  private static async handleBlockSchedule(payload: N8NIncomingPayload, dataService: any) {
    const { date, startHour, endHour } = payload.data;
    
    if (!date || !startHour || !endHour) {
      return { success: false, message: 'date, startHour e endHour são obrigatórios' };
    }
    
    console.log(`🔒 Bloqueando agenda em ${date} de ${startHour} até ${endHour}`);
    
    // Generating blocks logic (simplified)
    const slotsToBlock: string[] = [];
    const [startH, startM] = startHour.split(':').map(Number);
    const [endH, endM] = endHour.split(':').map(Number);
    let current = new Date(); current.setHours(startH, startM, 0, 0);
    const end = new Date(); end.setHours(endH, endM, 0, 0);

    while (current < end) {
      slotsToBlock.push(current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      current.setMinutes(current.getMinutes() + 30); // Default interval
    }

    const doctors = await dataService.getDoctors(payload.clinicId);
    if(doctors.length === 0) return { success: false, message: 'Nenhum médico encontrado para bloquear agenda.' };

    const newBlockAppointments = slotsToBlock.map((time: string) => ({
      clinicId: payload.clinicId,
      doctorId: doctors[0].id,
      patientId: 'system_block_n8n',
      patientName: 'AGENDA FECHADA (N8N)',
      patientPhone: '',
      date: date,
      time: time,
      status: AppointmentStatus.BLOQUEADO,
      notes: 'Bloqueio via Automação'
    }));
    
    await dataService.createBatchAppointments(newBlockAppointments);
    
    return {
      success: true,
      message: 'Agenda bloqueada com sucesso',
      data: { blockedSlots: newBlockAppointments.length }
    };
  }
  
  private static async handleCreateContact(payload: N8NIncomingPayload, dataService: any) {
    const { patientName, patientPhone, source, message } = payload.data;
    
    if (!patientName || !patientPhone) {
      return { success: false, message: 'patientName e patientPhone são obrigatórios' };
    }
    
    console.log(`👤 Criando contato de ${patientName} via ${source || 'desconhecido'}`);
    
    // Creating as "Em Contato"
    const doctors = await dataService.getDoctors(payload.clinicId);
    if(doctors.length === 0) return { success: false, message: 'Clínica sem médicos.' };

    await dataService.createAppointment({
      clinicId: payload.clinicId,
      doctorId: doctors[0].id,
      patientId: `lead_${Date.now()}`,
      patientName: patientName,
      patientPhone: patientPhone,
      date: new Date().toISOString().split('T')[0], // Today
      time: '00:00', // Placeholder
      status: AppointmentStatus.EM_CONTATO,
      procedure: 'Contato Inicial',
      notes: `Origem: ${source}. Mensagem: ${message || ''}`
    });
    
    return {
      success: true,
      message: 'Contato adicionado ao CRM',
      data: { contactId: `contact_${Date.now()}` }
    };
  }
}