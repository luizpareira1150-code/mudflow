
export enum ViewState {
  Dashboard = 'Dashboard',
  Agenda = 'Agenda',
  Patients = 'Patients',
  Settings = 'Settings'
}

export interface WebhookLog {
  id: string;
  event: string;
  payload: any;
  timestamp: string;
  status: 'Success' | 'Pending' | 'Failed';
  destination: string;
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

// ✅ NEW PATIENT INTERFACE
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

// ✅ UPDATED APPOINTMENT INTERFACE
export interface Appointment {
  id: string;
  clinicId: string; 
  doctorId: string; 
  slotId?: string;  
  
  // Relational Link - No more name/phone duplication
  patientId: string;
  patient?: Patient; // Populated at runtime via Service Join
  
  date: string; 
  time: string; 
  
  status: AppointmentStatus;
  procedure?: string; 
  notes?: string;     
  cancellationReason?: string;
  
  n8nProcessed?: boolean;
  createdAt?: string;

  // Legacy fields for migration support (optional)
  patientName?: string;
  patientPhone?: string;
}

export interface AgendaConfig {
  clinicId: string;
  doctorId?: string; // Configuração específica por médico
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
  clinicToken?: string; // Token legado para API de entrada
  apiToken?: string; // NOVO: Token único para autenticação N8N → Sistema
  n8nProductionMode?: boolean; // false = simulação, true = enviar de verdade
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
  lastUsed: string; // ISO date
  appointmentsThisMonth: number;
  appointmentsThisWeek: number;
  automationsActive: boolean;
  webhookStatus: 'healthy' | 'warning' | 'critical';
  healthScore: 'healthy' | 'attention' | 'risk'; // 🟢🟡🔴
  
  // Métricas semanais
  weeklyContacts: number;
  weeklyScheduled: number;
  weeklyAttended: number;
  weeklyCancelled: number;
  
  // Métricas mensais
  monthlyContacts: number;
  monthlyScheduled: number;
  monthlyAttended: number;
  monthlyCancelled: number;
  
  // Comparação
  growthVsLastMonth: number; // percentual
  
  // Tráfego pago (para análise de upsell)
  avgAppointmentsPerDay: number;
  availableSlots: number;
  occupancyRate: number; // %
  noShowRate: number; // %
  needsTrafficAnalysis: boolean;
}

export interface GlobalMetrics {
  totalClients: number;
  activeClients: number;
  totalAppointmentsThisMonth: number;
  totalAutomationsSent: number;
  automationSuccessRate: number;
  mrr: number; // Monthly Recurring Revenue
  growthRate: number; // % vs mês anterior
}
