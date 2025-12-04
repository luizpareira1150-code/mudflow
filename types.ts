
export enum ViewState {
  Dashboard = 'Dashboard',
  Agenda = 'Agenda',
  Patients = 'Patients',
  Settings = 'Settings',
  Logs = 'Logs'
}

export interface WebhookLog {
  id: string;
  event: string;
  payload: any;
  timestamp: string;
  status: 'Success' | 'Pending' | 'Failed';
  destination: string;
}

// ==========================================
// TIPOS DE AUDITORIA (AUDIT LOGS) - COMPLIANCE LGPD
// ==========================================

export enum AuditAction {
  // Contatos (CRM)
  CONTACT_CREATED = 'CONTACT_CREATED', // Lead entra em contato (EM_CONTATO)
  
  // Agendamentos
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_DELETED = 'APPOINTMENT_DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  AGENDA_BLOCKED = 'AGENDA_BLOCKED',
  
  // Pacientes
  PATIENT_CREATED = 'PATIENT_CREATED',
  PATIENT_UPDATED = 'PATIENT_UPDATED',
  
  // Usuários/Acesso
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  PASSWORD_RESET = 'PASSWORD_RESET',
  
  // Configurações e Equipe
  DOCTOR_CREATED = 'DOCTOR_CREATED',
  DOCTOR_DELETED = 'DOCTOR_DELETED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  AGENDA_CONFIG_UPDATED = 'AGENDA_CONFIG_UPDATED'
}

export enum AuditSource {
  WEB_APP = 'WEB_APP',           // Ação manual pela interface
  N8N_WEBHOOK = 'N8N_WEBHOOK',   // Ação via automação N8N
  WHATSAPP = 'WHATSAPP',         // Via WhatsApp (Evolution API)
  SYSTEM = 'SYSTEM'              // Ação automática do sistema (jobs, triggers)
}

export interface AuditLog {
  id: string;                    // UUID único
  
  // Identificação da Ação
  action: AuditAction;           // Tipo de ação realizada
  entityType: string;            // Tipo da entidade (Appointment, Patient, User, etc)
  entityId: string;              // ID da entidade afetada
  entityName?: string;           // Nome legível da entidade (ex: Nome do Paciente) - Cache para display
  
  // Contexto da Organização
  organizationId: string;        // Clínica/consultório
  
  // Quem fez a ação (Traceability)
  userId?: string;               // ID do usuário (se manual)
  userName?: string;             // Nome do usuário (cache)
  source: AuditSource;           // Origem da ação
  
  // Dados da Mudança (Compliance/LGPD)
  oldValues?: Record<string, any>;  // Valores antes da mudança (JSON)
  newValues?: Record<string, any>;  // Valores depois da mudança (JSON)
  
  // Informações Adicionais
  description: string;           // Descrição legível da ação
  metadata?: Record<string, any>; // Dados extras (IP, device, userAgent, etc)
  
  // Timestamp
  timestamp: string;             // Data e hora do evento (ISO 8601)
  readonly createdAt: string;    // Data de criação do registro (Imutável)
}

// --- CRM Domain Types ---

export enum UserRole {
  OWNER = 'OWNER',         
  DOCTOR_ADMIN = 'DOCTOR_ADMIN', 
  SECRETARY = 'SECRETARY'  
}

export enum AppointmentStatus {
  EM_CONTATO = 'EM_CONTATO', 
  AGENDADO = 'AGENDADO',     
  ATENDIDO = 'ATENDIDO',     
  NAO_VEIO = 'NAO_VEIO',     
  BLOQUEADO = 'BLOQUEADO'    
}

export enum PatientStatus {
  Active = 'Active',
  Recovering = 'Recovering',
  Inactive = 'Inactive',
  Critical = 'Critical'
}

export enum AccountType {
  CONSULTORIO = 'CONSULTORIO', // 1 médico apenas
  CLINICA = 'CLINICA'          // Múltiplos médicos
}

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  clinicId: string;
  phone1?: string;
  phone2?: string;
}

export interface Organization {
  id: string;
  accountType: AccountType;
  name: string;
  ownerUserId: string; 
  maxDoctors: number;
}

export interface Doctor {
  id: string;
  organizationId: string; 
  name: string;
  specialty: string;
  color?: string; // Hex code or Tailwind class
  avatar?: string;
}

export interface AvailableSlot {
  id: string;
  doctorId: string;
  date: string; 
  time: string; 
  isBooked: boolean;
  appointmentId?: string; 
  appointment?: Appointment; 
}

export interface Patient {
  id: string;
  organizationId: string;
  name: string;
  cpf?: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  
  // Clinical Status fields
  status: PatientStatus;
  condition?: string;
  lastVisit?: string;
  nextStep?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string; 
  doctorId: string; 
  slotId?: string;  
  
  patientId: string;
  patient?: Patient; 
  
  date: string; 
  time: string; 
  
  status: AppointmentStatus;
  procedure?: string; 
  notes?: string;     
  cancellationReason?: string;
  
  n8nProcessed?: boolean;
  createdAt?: string;
  updatedAt?: string;

  // Legacy fields for migration support
  patientName?: string;
  patientPhone?: string;
}

export interface AgendaConfig {
  clinicId: string;
  doctorId?: string; 
  startHour: string; 
  endHour: string;   
  intervalMinutes: number; 
  availableProcedures: string[]; 
}

export interface ClinicSettings {
  clinicId: string;
  n8nWebhookUrl?: string;       
  evolutionInstanceName?: string; 
  evolutionApiKey?: string;
  clinicToken?: string; 
  apiToken?: string; 
  n8nProductionMode?: boolean; 
}

export interface Session {
  id: string;
  userId: string;
  deviceInfo: string;
  lastActive: string;
}

export interface N8NWebhookPayload {
  event: 'STATUS_CHANGED' | 'APPOINTMENT_CREATED' | 'AGENDA_BLOCKED';
  data: {
    appointmentId?: string;
    doctorName?: string;
    patientName?: string;
    patientPhone?: string;
    reason?: string; 
    notes?: string;
    oldStatus?: string;
    newStatus?: string;
    date?: string;
    time?: string;
  };
  timestamp: string;
  clinicId: string; 
}

export interface Column {
  id: AppointmentStatus;
  title: string;
  color: string;
  count?: number;
}

// --- Analytics / Dashboard Types ---

export interface ClientHealthMetrics {
  clientId: string;
  clientName: string;
  accountType: 'CONSULTORIO' | 'CLINICA';
  lastUsed: string; 
  appointmentsThisMonth: number;
  appointmentsThisWeek: number;
  automationsActive: boolean;
  webhookStatus: 'healthy' | 'warning' | 'critical';
  healthScore: 'healthy' | 'attention' | 'risk'; 
  
  weeklyContacts: number;
  weeklyScheduled: number;
  weeklyAttended: number;
  weeklyCancelled: number;
  
  monthlyContacts: number;
  monthlyScheduled: number;
  monthlyAttended: number;
  monthlyCancelled: number;
  
  growthVsLastMonth: number; 
  
  avgAppointmentsPerDay: number;
  availableSlots: number;
  occupancyRate: number; 
  noShowRate: number; 
  needsTrafficAnalysis: boolean;
}

export interface GlobalMetrics {
  totalClients: number;
  activeClients: number;
  totalAppointmentsThisMonth: number;
  totalAutomationsSent: number;
  automationSuccessRate: number;
  mrr: number; 
  growthRate: number; 
}