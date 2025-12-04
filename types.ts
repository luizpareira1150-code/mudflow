export enum ViewState {
  Dashboard = 'Dashboard',
  Agenda = 'Agenda',
  Patients = 'Patients',
  Automations = 'Automations',
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

export interface Patient {
  id: string;
  organizationId?: string;
  name: string;
  age: number;
  condition: string;
  status: PatientStatus;
  lastVisit: string;
  email: string;
  phone: string;
  nextStep: string;
}

export interface Appointment {
  id: string;
  clinicId: string; 
  doctorId: string; 
  slotId?: string;  
  
  patientId: string;
  patientName: string; 
  patientPhone: string; 
  
  date: string; 
  time: string; 
  
  status: AppointmentStatus;
  procedure?: string; 
  notes?: string;     
  
  n8nProcessed?: boolean;
  createdAt?: string;
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