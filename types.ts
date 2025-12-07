

export enum AccountType {
  CONSULTORIO = 'CONSULTORIO',
  CLINICA = 'CLINICA'
}

export enum UserRole {
  OWNER = 'OWNER',
  DOCTOR_ADMIN = 'DOCTOR_ADMIN',
  SECRETARY = 'SECRETARY'
}

export enum ViewState {
  Dashboard = 'Dashboard',
  Agenda = 'Agenda',
  Patients = 'Patients',
  Settings = 'Settings',
  Logs = 'Logs',
  Metrics = 'Metrics'
}

export enum PatientStatus {
  Active = 'Active',
  Recovering = 'Recovering',
  Critical = 'Critical'
}

export enum AppointmentStatus {
  EM_CONTATO = 'EM_CONTATO',
  AGENDADO = 'AGENDADO',
  ATENDIMENTO_HUMANO = 'ATENDIMENTO_HUMANO',
  ATENDIDO = 'ATENDIDO',
  NAO_VEIO = 'NAO_VEIO',
  BLOQUEADO = 'BLOQUEADO'
}

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

// --- NEW AGENDA RELEASE TYPES ---
export enum AgendaReleaseType {
  ALWAYS_OPEN = 'ALWAYS_OPEN',           // Agenda sempre aberta (padrão)
  WEEKLY_RELEASE = 'WEEKLY_RELEASE',     // Abre semanalmente em dia/hora específico
  MONTHLY_RELEASE = 'MONTHLY_RELEASE',   // Abre mensalmente em dia específico
  CUSTOM_DATE = 'CUSTOM_DATE'            // Datas customizadas manualmente
}

export interface AgendaReleaseSchedule {
  id: string;
  doctorId: string;
  organizationId: string;
  releaseType: AgendaReleaseType;
  
  // Para WEEKLY_RELEASE (Ex: Dr. André)
  weeklyConfig?: {
    dayOfWeek: DayOfWeek;        // Ex: Segunda (1)
    hour: string;                 // Ex: "07:00"
    advanceDays: number;          // Ex: 2 (abre segunda para quarta)
  };
  
  // Para MONTHLY_RELEASE (Ex: Dr. João)
  monthlyConfig?: {
    releaseDay: number;           // Ex: 22 (dia 22 do mês)
    fallbackToWeekday: boolean;   // Se 22 cair no fim de semana, usar dia útil anterior?
    hour: string;                 // Ex: "00:00"
    targetMonthOffset: number;    // Ex: 1 (abre para mês seguinte)
  };
  
  // Para CUSTOM_DATE
  customDates?: {
    releaseDate: string;          // Ex: "2024-12-22"
    targetStartDate: string;      // Ex: "2025-01-01"
    targetEndDate: string;        // Ex: "2025-01-31"
  }[];
  
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
// --------------------------------

export enum AuditAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  DOCTOR_CREATED = 'DOCTOR_CREATED',
  DOCTOR_DELETED = 'DOCTOR_DELETED',
  PATIENT_CREATED = 'PATIENT_CREATED',
  PATIENT_UPDATED = 'PATIENT_UPDATED',
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_DELETED = 'APPOINTMENT_DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  CONTACT_CREATED = 'CONTACT_CREATED',
  AGENDA_BLOCKED = 'AGENDA_BLOCKED',
  AGENDA_CONFIG_UPDATED = 'AGENDA_CONFIG_UPDATED',
  SETTINGS_UPDATED = 'SETTINGS_UPDATED'
}

export enum AuditSource {
  WEB_APP = 'WEB_APP',
  N8N_WEBHOOK = 'N8N_WEBHOOK',
  WHATSAPP = 'WHATSAPP',
  SYSTEM = 'SYSTEM'
}

export interface Organization {
  id: string;
  name: string;
  accountType: AccountType;
  ownerUserId: string;
  maxDoctors: number;
  subscriptionValue?: number; // Valor mensal cobrado (MRR)
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

export interface Doctor {
  id: string;
  organizationId: string;
  name: string;
  specialty: string;
  crm?: string;
  color: string;
}

export interface Patient {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  status: PatientStatus;
  condition?: string;
  lastVisit?: string;
  nextStep?: string;
  birthDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId: string;
  patient?: Patient;
  date: string;
  time: string;
  status: AppointmentStatus;
  procedure?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  n8nProcessed?: boolean;
  slotId?: string;
}

export interface AgendaConfig {
  clinicId: string;
  doctorId?: string;
  startHour: string;
  endHour: string;
  intervalMinutes: number;
  availableProcedures: string[];
}

export interface DoctorAbsence {
  id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: 'FERIAS' | 'LICENCA' | 'CONGRESSO' | 'OUTROS';
  createdAt: string;
}

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  organizationId: string;
  weekSchedule: {
    [key in DayOfWeek]?: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      intervalMinutes?: number;
    };
  };
  absences: DoctorAbsence[];
  advanceBookingDays?: number;
  maxAppointmentsPerDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableSlot {
  id: string;
  doctorId: string;
  date: string;
  time: string;
  isBooked: boolean;
  isReserved: boolean;
  appointment?: Appointment;
  appointmentId?: string;
}

export interface RecommendedSlot {
  slot: AvailableSlot;
  score: number;
  reason: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  userName?: string;
  action: AuditAction;
  source: AuditSource;
  entityType: string;
  entityId: string;
  entityName?: string;
  description: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  timestamp: string;
  createdAt: string;
}

export interface ClinicSettings {
  clinicId: string;
  n8nWebhookUrl?: string;
  n8nProductionMode?: boolean;
  evolutionInstanceName?: string;
  evolutionApiKey?: string;
  clinicToken?: string;
  apiToken?: string;
}

export interface WebhookLog {
  id: string;
  event: string;
  payload: any;
  timestamp: string;
  status: 'Pending' | 'Success' | 'Failed';
  destination: string;
}

export interface WebhookQueueItem {
  id: string;
  url: string;
  payload: any;
  headers: any;
  retryCount: number;
  nextRetry: number;
  createdAt: number;
  status: 'PENDING' | 'FAILED' | 'SUCCESS';
}

export interface DashboardMetrics {
  general: {
    appointmentsThisMonth: number;
    appointmentsLastMonth: number;
    totalScheduled: number;
    totalAttended: number;
    totalNoShow: number;
    totalCancelled: number;
    attendanceRate: number;
    noShowRate: number;
  };
  automation: {
    totalInteractions: number;
    scheduledAutomatically: number;
    attendedViaAutomation: number;
    conversionRate: number;
    efficiencyRate: number;
    estimatedTimeSaved: number;
  };
  doctorStats: {
    doctorId: string;
    doctorName: string;
    totalAppointments: number;
    attended: number;
    noShow: number;
    attendanceRate: number;
  }[];
  topProcedures: {
    procedure: string;
    count: number;
  }[];
  timeline: {
    date: string;
    agendado: number;
    atendido: number;
    naoVeio: number;
  }[];
}

export interface ClientHealthMetrics {
  clientId: string;
  clientName: string;
  accountType: AccountType;
  lastUsed: string;
  appointmentsThisMonth: number;
  automationsActive: boolean;
  healthScore: 'healthy' | 'attention' | 'risk';
  occupancyRate: number;
  monthlyScheduled: number;
  growthVsLastMonth: number;
  availableSlots: number;
  noShowRate: number;
  webhookStatus: 'healthy' | 'error';
  needsTrafficAnalysis: boolean;
  weeklyContacts: number;
  weeklyScheduled: number;
  weeklyAttended: number;
  weeklyCancelled: number;
  monthlyContacts: number;
  monthlyAttended: number;
  monthlyCancelled: number;
}

export interface GlobalMetrics {
  activeClients: number;
  totalClients: number;
  totalAppointmentsThisMonth: number;
  growthRate: number;
  automationSuccessRate: number;
  totalAutomationsSent: number;
  mrr: number;
}

export interface OwnerAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  clientName: string;
  title: string;
  message: string;
  metricValue?: string;
  actionType: 'CONTACT_PHONE' | 'CONTACT_EMAIL' | 'OPEN_CONFIG' | 'VIEW_REPORT';
  actionPayload: string;
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'critical';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  clinicId: string;
  targetUserId?: string;
  targetRole?: UserRole[];
  metadata?: any;
  actionLink?: string;
  read: boolean;
  timestamp: string;
}

export interface SlotReservation {
  id: string;
  slotId: string;
  doctorId: string;
  date: string;
  time: string;
  clinicId: string;
  reservedBy: 'WEB_APP' | 'N8N_WEBHOOK';
  reservedAt: string;
  expiresAt: string;
  userId?: string;
  sessionId: string;
}

export interface Column {
  id: AppointmentStatus;
  title: string;
  color: string;
}

export interface AvailabilityValidationResult {
  isAvailable: boolean;
  reason?: string;
  suggestedDates?: string[];
}