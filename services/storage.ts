
import { Organization, User, Doctor, Appointment, Patient, AuditLog, AgendaConfig, ClinicSettings, AccountType, UserRole, AppointmentStatus, AuditSource, AuditAction, PatientStatus, DoctorAvailability, DayOfWeek, DoctorAccessControl } from '../types';

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

// ==========================================
// INITIAL MOCK DATA (SEED - BASIC)
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

// NOTE: "$SEED$123" is a placeholder token that corresponds to password "123".
// It will be automatically migrated to a secure WebCrypto hash on first login.
export const initialUsers: StoredUser[] = [
  { id: 'user_owner', name: 'Super Admin', username: 'admin', passwordHash: '$SEED$123', email: 'admin@medflow.com', role: UserRole.OWNER, clinicId: 'global' },
  { id: 'user_med_cli', name: 'Dr. Diretor', username: 'medicocli', passwordHash: '$SEED$123', email: 'diretor@clinica.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CLINICA_ID },
  { id: 'user_sec', name: 'Secretária Ana', username: 'secretaria', passwordHash: '$SEED$123', email: 'ana@clinica.com', role: UserRole.SECRETARY, clinicId: ORG_CLINICA_ID },
  { id: 'user_med_con', name: 'Dr. Roberto Solo', username: 'medicocon', passwordHash: '$SEED$123', email: 'roberto@consultorio.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CONSULTORIO_ID },
];

export const initialDoctors: Doctor[] = [
  { id: 'doc_cli_1', organizationId: ORG_CLINICA_ID, name: 'Dr. Diretor (Cardio)', specialty: 'Cardiologia', crm: '12345-SP', color: 'blue', accessControl: DoctorAccessControl.ALL, authorizedSecretaries: [] },
  { id: 'doc_cli_2', organizationId: ORG_CLINICA_ID, name: 'Dra. Julia (Derma)', specialty: 'Dermatologia', crm: '54321-SP', color: 'purple', accessControl: DoctorAccessControl.ALL, authorizedSecretaries: [] },
  { id: 'doc_cli_3', organizationId: ORG_CLINICA_ID, name: 'Dr. Pedro (Geral)', specialty: 'Clínico Geral', crm: '98765-SP', color: 'green', accessControl: DoctorAccessControl.ALL, authorizedSecretaries: [] },
  { id: 'doc_solo_1', organizationId: ORG_CONSULTORIO_ID, name: 'Dr. Roberto Solo', specialty: 'Pediatria', crm: '11122-MG', color: 'teal', accessControl: DoctorAccessControl.ALL, authorizedSecretaries: [] }
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
      [DayOfWeek.MONDAY]: { enabled: true, startTime: '08:00', endTime: '18:00', intervalMinutes: 30 },
      [DayOfWeek.TUESDAY]: { enabled: true, startTime: '08:00', endTime: '18:00', intervalMinutes: 30 },
      [DayOfWeek.WEDNESDAY]: { enabled: true, startTime: '08:00', endTime: '18:00', intervalMinutes: 30 },
      [DayOfWeek.THURSDAY]: { enabled: true, startTime: '08:00', endTime: '18:00', intervalMinutes: 30 },
      [DayOfWeek.FRIDAY]: { enabled: true, startTime: '08:00', endTime: '17:00', intervalMinutes: 30 }, // Ends early
    },
    absences: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
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

export const initialPatients: Patient[] = [
    {
        id: 'p_ex_1',
        organizationId: ORG_CLINICA_ID,
        name: 'Paciente Exemplo',
        phone: '11999999999',
        status: PatientStatus.Active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

export const initialAppointments: Appointment[] = [];
export const initialLogs: AuditLog[] = [];

// ==========================================
// STORAGE HELPERS (Safe)
// ==========================================

export const getStorage = <T>(key: string, initial: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      // Don't auto-set on read to avoid quota issues on startup
      return initial;
    }
    return JSON.parse(stored);
  } catch (e) {
    console.error("Storage Read Error", e);
    return initial;
  }
};

export const setStorage = <T>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    // 🔥 SAFEGUARD: QUOTA EXCEEDED HANDLING
    // If we hit the 5MB limit, we perform an emergency cleanup of non-critical data (Logs)
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
       console.warn("⚠️ STORAGE QUOTA EXCEEDED! Performing emergency cleanup...");
       
       // 1. Clear Logs (Most storage heavy, expendable)
       try {
           localStorage.setItem(STORAGE_KEYS.LOGS, '[]');
       } catch (clearErr) {
           console.error("Failed to clear logs", clearErr);
       }

       // 2. Retry original save
       try {
           localStorage.setItem(key, JSON.stringify(data));
           console.log("Recovered from Quota Exceeded by clearing logs.");
       } catch (retryErr) {
           console.error("CRITICAL: Storage still full after cleanup. Data lost.", retryErr);
           alert("ERRO CRÍTICO: Armazenamento cheio. Por favor, limpe os dados do navegador.");
       }
    } else {
        console.error("Unknown Storage Error", e);
    }
  }
};
