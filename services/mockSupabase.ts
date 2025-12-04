import { User, UserRole, Appointment, AppointmentStatus, AgendaConfig, ClinicSettings, Doctor, AvailableSlot, Organization, AccountType } from '../types';
import { N8NIntegrationService, N8NOutgoingPayload, generateApiToken } from './n8nIntegration';
import { passwordService } from './passwordService';

// Updated interface to use hash instead of plain password
interface StoredUser extends User {
  passwordHash: string;
}

// Initial Mock Data IDs
const ORG_CLINICA_ID = 'org_clinica_001';
const ORG_CONSULTORIO_ID = 'org_consultorio_001';

const initialOrganizations: Organization[] = [
  { id: ORG_CLINICA_ID, accountType: AccountType.CLINICA, name: 'Clínica Multi-Médicos', ownerUserId: 'user_med_cli', maxDoctors: 25 },
  { id: ORG_CONSULTORIO_ID, accountType: AccountType.CONSULTORIO, name: 'Consultório Dr. Solo', ownerUserId: 'user_med_con', maxDoctors: 1 }
];

// NOTE: Initial users are now initialized with a special prefix "PLAIN:" to trigger
// the auto-migration script on first load.
const initialUsers: StoredUser[] = [
  // 1. DONO
  { 
    id: 'user_owner', 
    name: 'Super Admin', 
    username: 'admin', 
    passwordHash: 'PLAIN:123', 
    email: 'admin@medflow.com', 
    role: UserRole.OWNER, 
    clinicId: 'global' 
  },
  
  // 2. MÉDICO CLÍNICA (Multi-agendas)
  { 
    id: 'user_med_cli', 
    name: 'Dr. Diretor', 
    username: 'medicocli', 
    passwordHash: 'PLAIN:123', 
    email: 'diretor@clinica.com', 
    role: UserRole.DOCTOR_ADMIN, 
    clinicId: ORG_CLINICA_ID 
  },
  
  // 3. SECRETÁRIA (Da Clínica)
  { 
    id: 'user_sec', 
    name: 'Secretária Ana', 
    username: 'secretaria', 
    passwordHash: 'PLAIN:123', 
    email: 'ana@clinica.com', 
    role: UserRole.SECRETARY, 
    clinicId: ORG_CLINICA_ID 
  },

  // 4. MÉDICO CONSULTÓRIO (Solo)
  { 
    id: 'user_med_con', 
    name: 'Dr. Roberto Solo', 
    username: 'medicocon', 
    passwordHash: 'PLAIN:123', 
    email: 'roberto@consultorio.com', 
    role: UserRole.DOCTOR_ADMIN, 
    clinicId: ORG_CONSULTORIO_ID 
  },
];

const initialDoctors: Doctor[] = [
  // Médicos da Clínica (Múltiplos)
  { id: 'doc_cli_1', organizationId: ORG_CLINICA_ID, name: 'Dr. Diretor (Cardio)', specialty: 'Cardiologia', color: 'blue' },
  { id: 'doc_cli_2', organizationId: ORG_CLINICA_ID, name: 'Dra. Julia (Derma)', specialty: 'Dermatologia', color: 'purple' },
  { id: 'doc_cli_3', organizationId: ORG_CLINICA_ID, name: 'Dr. Pedro (Geral)', specialty: 'Clínico Geral', color: 'green' },

  // Médico do Consultório (Único)
  { id: 'doc_solo_1', organizationId: ORG_CONSULTORIO_ID, name: 'Dr. Roberto Solo', specialty: 'Pediatria', color: 'teal' }
];

const initialAgendaConfigs: AgendaConfig[] = [
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

const initialSettings: ClinicSettings[] = [
  { 
    clinicId: ORG_CLINICA_ID, 
    n8nWebhookUrl: 'https://n8n.example.com/webhook-clinica',
    n8nProductionMode: false,
    evolutionInstanceName: 'instance_clinica',
    evolutionApiKey: 'token_clinica',
    clinicToken: 'token_legado_clinica',
    apiToken: 'api_token_clinica_123'
  },
  { 
    clinicId: ORG_CONSULTORIO_ID, 
    n8nWebhookUrl: 'https://n8n.example.com/webhook-consultorio',
    n8nProductionMode: false,
    evolutionInstanceName: 'instance_consultorio',
    evolutionApiKey: 'token_consultorio',
    apiToken: 'api_token_consultorio_123'
  }
];

const initialAppointments: Appointment[] = [
  { 
    id: 'appt_1', 
    clinicId: ORG_CLINICA_ID, 
    doctorId: 'doc_cli_1',
    slotId: 'slot_1',
    patientId: 'pat_1', 
    patientName: 'João da Silva',
    patientPhone: '11999990001',
    date: new Date().toISOString().split('T')[0], 
    time: '09:00', 
    status: AppointmentStatus.AGENDADO,
    procedure: 'Consulta Inicial',
    notes: 'Paciente novo'
  }
];

// Storage Keys
const ORGS_KEY = 'medflow_orgs';
const USERS_KEY = 'medflow_users';
const DOCTORS_KEY = 'medflow_doctors';
const APPOINTMENTS_KEY = 'medflow_appointments';
const CURRENT_USER_KEY = 'medflow_current_user';
const AGENDA_CONFIG_KEY = 'medflow_agenda_config';
const CLINIC_SETTINGS_KEY = 'medflow_clinic_settings';

// Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string, initial: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

const setStorage = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- SECURITY & MIGRATION SERVICE ---
// Automatically migrates plaintext passwords to bcrypt hashes on app load
const migratePasswords = async () => {
  const users = getStorage<any[]>(USERS_KEY, initialUsers);
  let hasChanges = false;
  
  const updatedUsers = await Promise.all(users.map(async (u) => {
    // 1. Handle "PLAIN:" prefix used in initialUsers
    if (u.passwordHash && u.passwordHash.startsWith('PLAIN:')) {
      const plain = u.passwordHash.replace('PLAIN:', '');
      u.passwordHash = await passwordService.hashPassword(plain);
      hasChanges = true;
      return u;
    }

    // 2. Handle legacy "password" field (Migration from old schema)
    if (u.password) {
      u.passwordHash = await passwordService.hashPassword(u.password);
      delete u.password; // Remove insecure field
      hasChanges = true;
      return u;
    }

    // 3. Handle legacy stored plaintext in passwordHash (Dev artifacts)
    if (u.passwordHash && passwordService.needsMigration(u.passwordHash)) {
      u.passwordHash = await passwordService.hashPassword(u.passwordHash);
      hasChanges = true;
      return u;
    }

    return u;
  }));

  if (hasChanges) {
    console.log('🔒 [Security] Migrated insecure passwords to bcrypt hashes.');
    setStorage(USERS_KEY, updatedUsers);
  }
};

// Trigger migration on module load (simulates app startup)
migratePasswords();


// --- N8N SIMULATION SERVICE ---
export const n8nService = {
  triggerWebhook: async (
    event: N8NOutgoingPayload['event'],
    data: any,
    description: string
  ) => {
    // 1. Buscar configurações da clínica
    const clinicId = data.clinicId || 'global';
    const settingsList = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    const settings = settingsList.find(s => s.clinicId === clinicId);
    
    if (!settings) {
      console.warn(`[N8N] Configurações não encontradas para clínica ${clinicId}`);
      return;
    }
    
    // 2. Buscar dados do médico
    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doctor = doctors.find(d => d.id === data.doctorId) || doctors[0];
    
    // 3. Buscar organização
    const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
    const org = orgs.find(o => o.id === clinicId);
    
    // 4. Montar payload completo
    const payload: N8NOutgoingPayload = {
      event,
      data: {
        appointmentId: data.id,
        patientName: data.patientName,
        patientPhone: data.patientPhone,
        date: data.date,
        time: data.time,
        status: data.status,
        oldStatus: data.oldStatus,
        procedure: data.procedure || data.reason,
        notes: data.notes,
        doctorId: data.doctorId,
        doctorName: doctor?.name || 'Médico',
        doctorSpecialty: doctor?.specialty,
        clinicId,
        clinicName: org?.name || 'Clínica',
        blockedSlotsCount: data.count,
        userId: data.userId,
        email: data.email,
        username: data.username,
        requestTime: data.requestTime
      },
      context: {
        evolutionApi: {
          instanceName: settings.evolutionInstanceName || '',
          apiKey: settings.evolutionApiKey || '',
          baseUrl: 'https://evolution-api.com' 
        },
        clinic: {
          id: clinicId,
          name: org?.name || 'Clínica',
          timezone: 'America/Sao_Paulo'
        },
        doctor: {
          id: doctor?.id || '',
          name: doctor?.name || 'Médico',
          specialty: doctor?.specialty || 'Clínico Geral'
        },
        timestamp: new Date().toISOString()
      }
    };
    
    // 5. Enviar para N8N
    await N8NIntegrationService.sendToN8N(payload, settings);
  }
};

export const authService = {
  login: async (username: string, password: string): Promise<User | null> => {
    await delay(500);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    
    // Find user by username only
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user && user.passwordHash) {
      // Verify password using bcrypt
      const isValid = await passwordService.verifyPassword(password, user.passwordHash);
      if (isValid) {
        const { passwordHash: _, ...safeUser } = user;
        setStorage(CURRENT_USER_KEY, safeUser);
        return safeUser;
      }
    }
    
    return null;
  },
  
  recoverPassword: async (identifier: string): Promise<boolean> => {
    await delay(1000);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const user = users.find(u => 
        u.email.toLowerCase() === identifier.toLowerCase() || 
        u.username.toLowerCase() === identifier.toLowerCase()
    );
    
    if (user) {
        n8nService.triggerWebhook('PASSWORD_RECOVERY', {
            userId: user.id,
            email: user.email,
            username: user.username,
            clinicId: user.clinicId,
            requestTime: new Date().toISOString()
        }, 'Triggering Recovery Flow');
        return true;
    }
    return false;
  },

  verifyPassword: async (password: string): Promise<boolean> => {
    await delay(300);
    const currentUser = getStorage<User | null>(CURRENT_USER_KEY, null);
    if (!currentUser) return false;
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const storedUser = users.find(u => u.id === currentUser.id);
    
    if (storedUser && storedUser.passwordHash) {
      return passwordService.verifyPassword(password, storedUser.passwordHash);
    }
    return false;
  },

  logout: async () => localStorage.removeItem(CURRENT_USER_KEY),
  
  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  }
};

export const dataService = {
  // ORGANIZATIONS
  getOrganizations: async (): Promise<Organization[]> => {
      return getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
  },
  
  getOrganization: async (clinicId: string): Promise<Organization | null> => {
    const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
    return orgs.find(o => o.id === clinicId) || null;
  },

  // DOCTORS
  getDoctors: async (clinicId: string): Promise<Doctor[]> => {
    await delay(200);
    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    return doctors.filter(d => d.organizationId === clinicId);
  },

  createDoctor: async (doctor: Omit<Doctor, 'id'>): Promise<Doctor> => {
    await delay(300);
    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const newDoctor = { ...doctor, id: `doc_${Date.now()}` };
    doctors.push(newDoctor);
    setStorage(DOCTORS_KEY, doctors);
    
    n8nService.triggerWebhook('DOCTOR_CREATED', {
        doctorId: newDoctor.id,
        doctorName: newDoctor.name,
        clinicId: doctor.organizationId
    }, 'Doctor Created');

    // Notify app to update state
    window.dispatchEvent(new Event('medflow:doctors-updated'));

    return newDoctor;
  },

  deleteDoctor: async (doctorId: string): Promise<void> => {
    await delay(300);
    let doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doc = doctors.find(d => d.id === doctorId);
    doctors = doctors.filter(d => d.id !== doctorId);
    setStorage(DOCTORS_KEY, doctors);
    
    // Cascading delete: Appointments
    let appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    appts = appts.filter(a => a.doctorId !== doctorId);
    setStorage(APPOINTMENTS_KEY, appts);
    
    // Cascading delete: Configs
    let configs = getStorage<AgendaConfig[]>(AGENDA_CONFIG_KEY, initialAgendaConfigs);
    configs = configs.filter(c => c.doctorId !== doctorId);
    setStorage(AGENDA_CONFIG_KEY, configs);

    if (doc) {
        n8nService.triggerWebhook('DOCTOR_DELETED', {
            doctorId: doc.id,
            doctorName: doc.name,
            clinicId: doc.organizationId
        }, 'Doctor Deleted');
    }

    // Notify app to update state
    window.dispatchEvent(new Event('medflow:doctors-updated'));
  },

  // USERS
  getUsers: async (clinicId?: string): Promise<User[]> => {
    await delay(300);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const filtered = (clinicId && clinicId !== 'global') ? users.filter(u => u.clinicId === clinicId) : users;
    // Return safe users without password hash
    return filtered.map(({ passwordHash, ...u }) => u);
  },
  
  createUser: async (user: Omit<StoredUser, 'id' | 'passwordHash'> & { password?: string; accountType?: AccountType; organizationName?: string }): Promise<User> => {
    await delay(300);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    if (users.some(u => u.username === user.username)) throw new Error("Nome de usuário já existe.");
    
    if (user.role === UserRole.SECRETARY) {
        const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
        const org = orgs.find(o => o.id === user.clinicId);
        const maxSecretaries = org?.accountType === AccountType.CLINICA ? 5 : 2;
        const count = users.filter(u => u.clinicId === user.clinicId && u.role === UserRole.SECRETARY).length;
        if (count >= maxSecretaries) throw new Error(`Limite atingido: Você só pode criar até ${maxSecretaries} contas de secretária.`);
    }
    
    // Hash password before saving
    const plainPassword = user.password || '123456'; // Fallback only if missing (should not happen in UI)
    const hashedPassword = await passwordService.hashPassword(plainPassword);

    const newUser: StoredUser = { 
      id: Math.random().toString(36).substr(2, 9),
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      passwordHash: hashedPassword
    };

    users.push(newUser);
    setStorage(USERS_KEY, users);
    
    if (user.role === UserRole.DOCTOR_ADMIN && user.accountType && user.organizationName) {
        const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
        orgs.push({
            id: user.clinicId,
            accountType: user.accountType,
            name: user.organizationName,
            ownerUserId: newUser.id,
            maxDoctors: user.accountType === AccountType.CONSULTORIO ? 1 : 25
        });
        setStorage(ORGS_KEY, orgs);
        
        const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
        doctors.push({
            id: newUser.id,
            organizationId: user.clinicId,
            name: user.name,
            specialty: 'Clínico Geral',
            color: 'blue'
        });
        setStorage(DOCTORS_KEY, doctors);
    }

    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  },

  deleteUser: async (id: string): Promise<void> => {
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    setStorage(USERS_KEY, users.filter(u => u.id !== id));
  },
  
  resetPassword: async (id: string, pass: string): Promise<void> => {
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex >= 0) { 
      users[userIndex].passwordHash = await passwordService.hashPassword(pass);
      setStorage(USERS_KEY, users); 
    }
  },

  // CONFIGURATION (AGENDA)
  getAgendaConfig: async (clinicId: string, doctorId?: string): Promise<AgendaConfig> => {
    const configs = getStorage<AgendaConfig[]>(AGENDA_CONFIG_KEY, initialAgendaConfigs);
    
    if (doctorId) {
        const docConfig = configs.find(c => c.clinicId === clinicId && c.doctorId === doctorId);
        if (docConfig) return docConfig;
    }

    const clinicConfig = configs.find(c => c.clinicId === clinicId && !c.doctorId);
    const base = clinicConfig || initialAgendaConfigs[0];
    
    return { ...base, clinicId, doctorId };
  },
  
  updateAgendaConfig: async (newConfig: AgendaConfig): Promise<void> => {
    await delay(300);
    let configs = getStorage<AgendaConfig[]>(AGENDA_CONFIG_KEY, initialAgendaConfigs);
    
    const index = configs.findIndex(c => 
        c.clinicId === newConfig.clinicId && 
        c.doctorId === newConfig.doctorId
    );
    
    if (index >= 0) configs[index] = newConfig;
    else configs.push(newConfig);
    
    setStorage(AGENDA_CONFIG_KEY, configs);
  },

  getProcedureOptions: async (clinicId: string, doctorId?: string): Promise<string[]> => {
    const config = await dataService.getAgendaConfig(clinicId, doctorId);
    return config?.availableProcedures || ['Consulta'];
  },

  getClinicSettings: async (clinicId: string): Promise<ClinicSettings> => {
    const settings = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    let clinicSetting = settings.find(s => s.clinicId === clinicId);
    
    if (!clinicSetting) {
        // Initialize default if not found
        clinicSetting = { clinicId, clinicToken: `clinic_${Date.now()}` };
        settings.push(clinicSetting);
        setStorage(CLINIC_SETTINGS_KEY, settings);
    }
    return clinicSetting;
  },

  updateClinicSettings: async (newSettings: ClinicSettings): Promise<void> => {
    await delay(300);
    
    // Auto-generate Token if missing
    if (!newSettings.apiToken) {
      newSettings.apiToken = generateApiToken(newSettings.clinicId);
      console.log(`[Sistema] Token de API gerado automaticamente para ${newSettings.clinicId}`);
    }

    let settings = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    const index = settings.findIndex(s => s.clinicId === newSettings.clinicId);
    if (index >= 0) settings[index] = newSettings;
    else settings.push(newSettings);
    setStorage(CLINIC_SETTINGS_KEY, settings);
  },

  // SLOTS & APPOINTMENTS (adicione dentro do dataService)
  getAvailableSlots: async (clinicId: string, doctorId: string, date: string): Promise<AvailableSlot[]> => {
    await delay(300);
    const config = await dataService.getAgendaConfig(clinicId, doctorId);
    
    const allAppts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const doctorAppts = allAppts.filter(a => 
      a.clinicId === clinicId && 
      a.doctorId === doctorId && 
      a.date === date && 
      a.status !== AppointmentStatus.NAO_VEIO
    );

    const slots: AvailableSlot[] = [];
    const [startH, startM] = config.startHour.split(':').map(Number);
    const [endH, endM] = config.endHour.split(':').map(Number);
    
    let current = new Date();
    current.setHours(startH, startM, 0, 0);
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    while (current < end) {
      const timeStr = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const booking = doctorAppts.find(a => a.time === timeStr);
      
      slots.push({
        id: `slot_${date}_${timeStr}`,
        doctorId: doctorId,
        date: date,
        time: timeStr,
        isBooked: !!booking,
        appointment: booking,
        appointmentId: booking?.id
      });

      current.setMinutes(current.getMinutes() + config.intervalMinutes);
    }

    return slots;
  },

  getAppointments: async (clinicId: string, date: string, doctorId?: string): Promise<Appointment[]> => {
    await delay(200);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    let filtered = appts.filter(a => a.clinicId === clinicId && a.date === date);
    if (doctorId) {
        filtered = filtered.filter(a => a.doctorId === doctorId);
    }
    return filtered;
  },

  createAppointment: async (appt: Omit<Appointment, 'id'>): Promise<Appointment> => {
    await delay(300);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    
    const exists = appts.some(a => 
      a.clinicId === appt.clinicId && 
      a.doctorId === appt.doctorId &&
      a.date === appt.date && 
      a.time === appt.time &&
      a.status !== AppointmentStatus.NAO_VEIO
    );

    if (exists) throw new Error("Horário já ocupado para este médico!");

    const newAppt = { ...appt, id: Math.random().toString(36).substr(2, 9) };
    appts.push(newAppt);
    setStorage(APPOINTMENTS_KEY, appts);

    n8nService.triggerWebhook('APPOINTMENT_CREATED', {
        ...newAppt,
        reason: appt.procedure,
        doctorName: appt.doctorId // Will be resolved in n8nService
    }, 'Appointment Created');
    
    return newAppt;
  },

  createBatchAppointments: async (newAppts: Omit<Appointment, 'id'>[]): Promise<void> => {
    await delay(400);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const created = newAppts.map(a => ({ ...a, id: Math.random().toString(36).substr(2, 9) }));
    
    let addedCount = 0;
    created.forEach(newItem => {
        const exists = appts.some(old => 
            old.clinicId === newItem.clinicId && 
            old.doctorId === newItem.doctorId &&
            old.date === newItem.date && 
            old.time === newItem.time &&
            old.status !== AppointmentStatus.NAO_VEIO
        );
        if (!exists) {
            appts.push(newItem);
            addedCount++;
        }
    });

    setStorage(APPOINTMENTS_KEY, appts);
    
    if (created.length > 0) {
        n8nService.triggerWebhook('AGENDA_BLOCKED', { 
            count: addedCount,
            doctorId: created[0].doctorId,
            date: created[0].date,
            clinicId: created[0].clinicId
        }, 'Agenda Blocked');
    }
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus): Promise<Appointment> => {
    await delay(200);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const index = appts.findIndex(a => a.id === id);
    if (index === -1) throw new Error("Not found");
    
    const oldStatus = appts[index].status;
    appts[index].status = status;
    setStorage(APPOINTMENTS_KEY, appts);
    
    const updatedAppt = appts[index];

    n8nService.triggerWebhook('STATUS_CHANGED', { 
        ...updatedAppt, 
        reason: updatedAppt.procedure,
        oldStatus 
    }, 'Status Update');
    
    return updatedAppt;
  },

  updateAppointment: async (updatedAppt: Appointment): Promise<Appointment> => {
    await delay(300);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const index = appts.findIndex(a => a.id === updatedAppt.id);
    if (index === -1) throw new Error("Agendamento não encontrado");

    const currentAppt = appts[index];
    const isReschedule = currentAppt.date !== updatedAppt.date || currentAppt.time !== updatedAppt.time;

    if (isReschedule) {
      const isBooked = appts.some(a => 
        a.id !== updatedAppt.id && 
        a.clinicId === updatedAppt.clinicId && 
        a.doctorId === updatedAppt.doctorId && 
        a.date === updatedAppt.date && 
        a.time === updatedAppt.time &&
        a.status !== AppointmentStatus.NAO_VEIO
      );
      if (isBooked) throw new Error("Conflito! Horário ocupado para este médico.");
    }

    appts[index] = updatedAppt;
    setStorage(APPOINTMENTS_KEY, appts);
    return updatedAppt;
  },

  deleteAppointment: async (id: string, reason?: string): Promise<void> => {
    await delay(300);
    if (reason) {
      console.log(`[Audit] Agendamento ${id} cancelado pelo motivo: ${reason}`);
    }
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    setStorage(APPOINTMENTS_KEY, appts.filter(a => a.id !== id));
  },

  subscribeToAgendaSlots: (
    clinicId: string, 
    doctorId: string, 
    date: string, 
    onUpdate: (slots: AvailableSlot[]) => void
  ) => {
    dataService.getAvailableSlots(clinicId, doctorId, date).then(onUpdate);
    const interval = setInterval(async () => {
      const slots = await dataService.getAvailableSlots(clinicId, doctorId, date);
      onUpdate(slots);
    }, 3000);
    return () => clearInterval(interval);
  },

  subscribeToAppointments: (
    clinicId: string, 
    date: string, 
    doctorId: string, 
    onUpdate: (appts: Appointment[]) => void
  ) => {
    dataService.getAppointments(clinicId, date, doctorId).then(onUpdate);
    const interval = setInterval(async () => {
      const appts = await dataService.getAppointments(clinicId, date, doctorId);
      onUpdate(appts);
    }, 3000);
    return () => clearInterval(interval);
  }
};

// --- INBOUND WEBHOOK SERVICE ---
export const webhookService = {
  receiveFromN8N: async (payload: {
    action: 'CREATE_APPOINTMENT' | 'UPDATE_STATUS' | 'BLOCK_SCHEDULE' | 'CREATE_PATIENT_CONTACT';
    data: any;
    clinicId: string;
    authToken: string;
  }) => {
    await delay(200);
    
    // Validate Token and Process via N8NIntegrationService
    const settings = await dataService.getClinicSettings(payload.clinicId);
    
    // Construct Valid Tokens Map for Service
    const validTokens = new Map<string, string>();
    if (settings.apiToken) validTokens.set(payload.clinicId, settings.apiToken);
    
    // Fallback to old token if new one not present (migration support)
    if (!settings.apiToken && settings.clinicToken) validTokens.set(payload.clinicId, settings.clinicToken);

    // Pass dataService to avoid circular dependency issues in N8NIntegrationService
    return await N8NIntegrationService.receiveFromN8N(payload as any, validTokens, dataService);
  }
};