
import { Organization, User, Doctor, Appointment, Patient, AuditLog, AgendaConfig, ClinicSettings, AccountType, UserRole, AppointmentStatus, AuditSource, AuditAction, PatientStatus, DoctorAvailability, DayOfWeek } from '../types';

// ==========================================
// CONSTANTS & KEYS
// ==========================================
export const STORAGE_KEYS = {
  ORGS: 'medflow_orgs',
  USERS: 'medflow_users',
  DOCTORS: 'medflow_doctors',
  APPOINTMENTS: 'medflow_appointments',
  PATIENTS: 'medflow_patients',
  LOGS: 'medflow_audit_logs',
  CURRENT_USER: 'medflow_current_user',
  AGENDA_CONFIG: 'medflow_agenda_config',
  CLINIC_SETTINGS: 'medflow_clinic_settings',
  DOCTOR_AVAILABILITY: 'medflow_doctor_availability',
  WEBHOOK_QUEUE: 'medflow_webhook_queue'
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getStorage = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

export const setStorage = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// INITIAL MOCK DATA (SEED)
// ==========================================

export const ORG_CLINICA_ID = 'org_clinica_001';
export const ORG_CONSULTORIO_ID = 'org_consultorio_001';

export const initialOrganizations: Organization[] = [
  { id: ORG_CLINICA_ID, accountType: AccountType.CLINICA, name: 'Clínica Multi-Médicos', ownerUserId: 'user_med_cli', maxDoctors: 25, subscriptionValue: 400 },
  { id: ORG_CONSULTORIO_ID, accountType: AccountType.CONSULTORIO, name: 'Consultório Dr. Solo', ownerUserId: 'user_med_con', maxDoctors: 1, subscriptionValue: 150 }
];

export interface StoredUser extends User {
  passwordHash: string;
}

export const initialUsers: StoredUser[] = [
  { id: 'user_owner', name: 'Super Admin', username: 'admin', passwordHash: 'PLAIN:123', email: 'admin@medflow.com', role: UserRole.OWNER, clinicId: 'global' },
  { id: 'user_med_cli', name: 'Dr. Diretor', username: 'medicocli', passwordHash: 'PLAIN:123', email: 'diretor@clinica.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CLINICA_ID },
  { id: 'user_sec', name: 'Secretária Ana', username: 'secretaria', passwordHash: 'PLAIN:123', email: 'ana@clinica.com', role: UserRole.SECRETARY, clinicId: ORG_CLINICA_ID },
  { id: 'user_med_con', name: 'Dr. Roberto Solo', username: 'medicocon', passwordHash: 'PLAIN:123', email: 'roberto@consultorio.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CONSULTORIO_ID },
];

export const initialDoctors: Doctor[] = [
  { id: 'doc_cli_1', organizationId: ORG_CLINICA_ID, name: 'Dr. Diretor (Cardio)', specialty: 'Cardiologia', crm: '12345-SP', color: 'blue' },
  { id: 'doc_cli_2', organizationId: ORG_CLINICA_ID, name: 'Dra. Julia (Derma)', specialty: 'Dermatologia', crm: '54321-SP', color: 'purple' },
  { id: 'doc_cli_3', organizationId: ORG_CLINICA_ID, name: 'Dr. Pedro (Geral)', specialty: 'Clínico Geral', crm: '98765-SP', color: 'green' },
  { id: 'doc_solo_1', organizationId: ORG_CONSULTORIO_ID, name: 'Dr. Roberto Solo', specialty: 'Pediatria', crm: '11122-MG', color: 'teal' }
];

export const initialAgendaConfigs: AgendaConfig[] = [
  { 
    clinicId: ORG_CLINICA_ID, 
    startHour: '08:00', 
    endHour: '18:00', 
    intervalMinutes: 30,
    availableProcedures: ['Consulta Inicial', 'Retorno', 'Exame', 'Procedimento']
  },
  { 
    clinicId: ORG_CONSULTORIO_ID, 
    startHour: '09:00', 
    endHour: '17:00', 
    intervalMinutes: 60,
    availableProcedures: ['Consulta Pediátrica', 'Vacinação', 'Emergência']
  }
];

export const initialAvailability: DoctorAvailability[] = [
  {
    id: 'avail_1',
    doctorId: 'doc_cli_1',
    organizationId: ORG_CLINICA_ID,
    weekSchedule: {
      [DayOfWeek.MONDAY]: { enabled: true, startTime: '08:00', endTime: '12:00', intervalMinutes: 30 },
      [DayOfWeek.WEDNESDAY]: { enabled: true, startTime: '13:00', endTime: '19:00', intervalMinutes: 30 },
      [DayOfWeek.FRIDAY]: { enabled: true, startTime: '08:00', endTime: '16:00', intervalMinutes: 30 },
    },
    absences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'avail_2',
    doctorId: 'doc_cli_2',
    organizationId: ORG_CLINICA_ID,
    weekSchedule: {
      [DayOfWeek.TUESDAY]: { enabled: true, startTime: '09:00', endTime: '18:00', intervalMinutes: 45 },
      [DayOfWeek.THURSDAY]: { enabled: true, startTime: '09:00', endTime: '18:00', intervalMinutes: 45 },
    },
    absences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialSettings: ClinicSettings[] = [
  { 
    clinicId: ORG_CLINICA_ID, 
    n8nWebhookUrl: '',
    n8nProductionMode: false,
    evolutionInstanceName: '',
    evolutionApiKey: '',
    clinicToken: 'token_legado_clinica',
    apiToken: 'api_token_clinica_123'
  },
  { 
    clinicId: ORG_CONSULTORIO_ID, 
    n8nWebhookUrl: '',
    n8nProductionMode: false,
    evolutionInstanceName: '',
    evolutionApiKey: '',
    apiToken: 'api_token_consultorio_123'
  }
];

// DADOS DE PACIENTES VAZIOS PARA INÍCIO LIMPO
export const initialPatients: Patient[] = [];

// DADOS DE AGENDAMENTOS VAZIOS PARA INÍCIO LIMPO
export const initialAppointments: Appointment[] = [];

// LOGS VAZIOS PARA INÍCIO LIMPO
export const initialLogs: AuditLog[] = [];
