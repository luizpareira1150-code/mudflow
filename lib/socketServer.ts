
/**
 * SERVIDOR WEBSOCKET SIMULADO
 * 
 * Como não temos backend real (localStorage mock), usamos BroadcastChannel
 * para comunicação entre tabs/janelas do navegador.
 * 
 * Quando tiver Supabase real, substituir por Socket.IO verdadeiro.
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

interface SocketMessage {
  event: SocketEvent;
  data: any;
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
      const message: SocketMessage = event.data;
      this.handleIncomingMessage(message);
    };
    
    console.log('🔌 [WebSocket Mock] Servidor iniciado');
  }
  
  /**
   * Emitir evento (broadcaster para todas as tabs)
   */
  emit(event: SocketEvent, data: any, organizationId: string, userId?: string): void {
    const message: SocketMessage = {
      event,
      data,
      organizationId,
      timestamp: new Date().toISOString(),
      userId
    };
    
    // Enviar para todas as tabs abertas
    this.channel.postMessage(message);
    
    // Opcional: Acionar listeners locais na mesma tab também (para consistência)
    // No React com hooks de realtime, geralmente queremos recarregar dados
    // independente se a mudança foi local ou remota para garantir sync.
    this.handleIncomingMessage(message);
    
    // Log no console
    // console.log('📡 [WebSocket] EMIT:', event, data);
  }
  
  /**
   * Escutar evento específico
   */
  on(event: SocketEvent, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Retornar função de cleanup
    return () => {
      this.listeners.get(event)?.delete(callback);
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
