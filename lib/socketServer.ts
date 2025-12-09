
import { Appointment, Patient, Doctor, User, ClinicSettings, AgendaConfig } from '../types';

/**
 * SERVIDOR WEBSOCKET SIMULADO
 * 
 * Como não temos backend real (localStorage mock), usamos BroadcastChannel
 * para comunicação entre tabs/janelas do navegador.
 */

export enum SocketEvent {
  // Appointments
  APPOINTMENT_CREATED = 'appointment:created',
  APPOINTMENT_UPDATED = 'appointment:updated',
  APPOINTMENT_DELETED = 'appointment:deleted',
  APPOINTMENT_STATUS_CHANGED = 'appointment:status_changed',
  
  // Patients
  PATIENT_CREATED = 'patient:created',
  PATIENT_UPDATED = 'patient:updated',
  
  // Doctors
  DOCTOR_CREATED = 'doctor:created',
  DOCTOR_DELETED = 'doctor:deleted',
  
  // Users
  USER_CREATED = 'user:created',
  USER_DELETED = 'user:deleted',
  
  // Settings
  SETTINGS_UPDATED = 'settings:updated',
  AGENDA_CONFIG_UPDATED = 'agenda_config:updated'
}

// ✅ STRICT TYPE MAPPING FOR EVENTS
export interface SocketPayloadMap {
  [SocketEvent.APPOINTMENT_CREATED]: Appointment & { patient: Patient };
  [SocketEvent.APPOINTMENT_UPDATED]: Appointment;
  [SocketEvent.APPOINTMENT_DELETED]: { id: string; appointment: Appointment };
  [SocketEvent.APPOINTMENT_STATUS_CHANGED]: { id: string; oldStatus: string; newStatus: string; appointment: Appointment };
  
  [SocketEvent.PATIENT_CREATED]: Patient;
  [SocketEvent.PATIENT_UPDATED]: Patient;
  
  [SocketEvent.DOCTOR_CREATED]: Doctor;
  [SocketEvent.DOCTOR_DELETED]: { id: string; doctor: Doctor };
  
  [SocketEvent.USER_CREATED]: User;
  [SocketEvent.USER_DELETED]: { id: string; user: User };
  
  [SocketEvent.SETTINGS_UPDATED]: ClinicSettings;
  [SocketEvent.AGENDA_CONFIG_UPDATED]: AgendaConfig;
}

interface SocketMessage<K extends keyof SocketPayloadMap = keyof SocketPayloadMap> {
  event: K;
  data: SocketPayloadMap[K];
  organizationId: string;
  timestamp: string;
  userId?: string;
}

class MockSocketServer {
  private channel: BroadcastChannel;
  private listeners: Map<SocketEvent, Set<(data: any) => void>>;
  
  constructor() {
    // Canal de broadcast (funciona entre tabs)
    this.channel = new BroadcastChannel('medflow_realtime');
    this.listeners = new Map();
    
    // Escutar mensagens de outras tabs
    this.channel.onmessage = (event) => {
      const message = event.data as SocketMessage;
      this.handleIncomingMessage(message);
    };
    
    console.log('🔌 [WebSocket Mock] Servidor iniciado');
  }
  
  /**
   * Emitir evento com TIPO ESTRITO
   */
  emit<K extends keyof SocketPayloadMap>(
    event: K, 
    data: SocketPayloadMap[K], 
    organizationId: string, 
    userId?: string
  ): void {
    const message: SocketMessage<K> = {
      event,
      data,
      organizationId,
      timestamp: new Date().toISOString(),
      userId
    };
    
    // Enviar para todas as tabs abertas
    this.channel.postMessage(message);
    
    // Acionar listeners locais
    this.handleIncomingMessage(message);
  }
  
  /**
   * Escutar evento específico
   */
  on<K extends keyof SocketPayloadMap>(
    event: K, 
    callback: (data: SocketPayloadMap[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    // Cast to generic listener for internal storage
    this.listeners.get(event)!.add(callback as (data: any) => void);
    
    // Retornar função de cleanup
    return () => {
      this.listeners.get(event)?.delete(callback as (data: any) => void);
    };
  }
  
  /**
   * Processar mensagem recebida
   */
  private handleIncomingMessage(message: SocketMessage): void {
    const listeners = this.listeners.get(message.event);
    
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(message.data);
        } catch (error) {
          console.error('Erro ao processar evento WebSocket:', error);
        }
      });
    }
  }
  
  /**
   * Desconectar (cleanup)
   */
  disconnect(): void {
    this.channel.close();
    this.listeners.clear();
    console.log('🔌 [WebSocket Mock] Desconectado');
  }
}

// Exportar instância singleton
export const socketServer = new MockSocketServer();
