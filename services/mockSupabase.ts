import { User, UserRole, Appointment, AppointmentStatus, AgendaConfig, ClinicSettings, Doctor, AvailableSlot, Organization, AccountType } from '../types';

interface StoredUser extends User {
  password?: string;
}

// Initial Mock Data
const MOCK_CLINIC_ID = 'clinic_123';

const initialOrganizations: Organization[] = [
  { id: MOCK_CLINIC_ID, accountType: AccountType.CLINICA, name: 'Clínica Exemplo', ownerUserId: 'owner_001', maxDoctors: 999 }
];

const initialUsers: StoredUser[] = [
  { id: 'owner_001', name: 'Sr. Dono', username: 'admin', password: '123', email: 'dono@medflow.com', role: UserRole.OWNER, clinicId: 'global' },
  { id: 'doc_admin_1', name: 'Dr. Gestor', username: 'medico', password: '123', email: 'medico@medflow.com', role: UserRole.DOCTOR_ADMIN, clinicId: MOCK_CLINIC_ID },
  { id: 'sec_1', name: 'Maria Secretária', username: 'secretaria', password: '123', email: 'sec@medflow.com', role: UserRole.SECRETARY, clinicId: MOCK_CLINIC_ID },
];

const initialDoctors: Doctor[] = [
  { id: 'doc_1', organizationId: MOCK_CLINIC_ID, name: 'Dr. House', specialty: 'Diagnóstico', color: 'blue' },
  { id: 'doc_2', organizationId: MOCK_CLINIC_ID, name: 'Dr. Wilson', specialty: 'Oncologia', color: 'green' }
];

const initialAgendaConfigs: AgendaConfig[] = [
  { 
    clinicId: MOCK_CLINIC_ID, 
    startHour: '08:00', 
    endHour: '18:00', 
    intervalMinutes: 30,
    availableProcedures: ['Consulta Inicial', 'Retorno', 'Exame de Rotina', 'Procedimento Estético']
  }
];

const initialSettings: ClinicSettings[] = [
  { 
    clinicId: MOCK_CLINIC_ID, 
    n8nWebhookUrl: 'https://n8n.example.com/webhook',
    evolutionInstanceName: 'instance_1',
    evolutionApiKey: 'token_123'
  }
];

const initialAppointments: Appointment[] = [
  { 
    id: 'appt_1', 
    clinicId: MOCK_CLINIC_ID, 
    doctorId: 'doc_1',
    slotId: 'slot_init_1',
    patientId: 'pat_1', 
    patientName: 'João Silva',
    patientPhone: '5511999999999',
    date: new Date().toISOString().split('T')[0], 
    time: '09:00', 
    status: AppointmentStatus.AGENDADO,
    procedure: 'Consulta Inicial',
    notes: 'Primeira vez na clínica'
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

// --- N8N SIMULATION SERVICE ---
export const n8nService = {
  triggerWebhook: async (event: string, payload: any, description: string) => {
    const clinicId = payload.clinicId || 'global';
    const settingsList = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    const settings = settingsList.find(s => s.clinicId === clinicId);
    const webhookUrl = settings?.n8nWebhookUrl || 'NOT_CONFIGURED';
    
    console.group(`🚀 [N8N Webhook Simulation]`);
    console.log(`%cTarget: ${webhookUrl}`, 'color: gray; font-size: 0.8em;');
    console.log(`%cEvent: ${event}`, 'color: #3b82f6; font-weight: bold;');
    console.log(`%cPayload (sent to N8N):`, 'color: #10b981;', payload);
    console.groupEnd();
  }
};

export const authService = {
  login: async (username: string, password: string): Promise<User | null> => {
    await delay(500);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      const { password: _, ...safeUser } = user;
      setStorage(CURRENT_USER_KEY, safeUser);
      return safeUser;
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
    return storedUser ? storedUser.password === password : false;
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
    return newDoctor;
  },

  deleteDoctor: async (doctorId: string): Promise<void> => {
    await delay(300);
    let doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
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
  },

  // USERS
  getUsers: async (clinicId?: string): Promise<User[]> => {
    await delay(300);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const filtered = (clinicId && clinicId !== 'global') ? users.filter(u => u.clinicId === clinicId) : users;
    return filtered.map(({ password, ...u }) => u);
  },
  
  createUser: async (user: Omit<StoredUser, 'id'> & { accountType?: AccountType; organizationName?: string }): Promise<User> => {
    await delay(300);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    if (users.some(u => u.username === user.username)) throw new Error("Nome de usuário já existe.");
    if (user.role === UserRole.SECRETARY) {
        const count = users.filter(u => u.clinicId === user.clinicId && u.role === UserRole.SECRETARY).length;
        if (count >= 2) throw new Error("Limite atingido: Você só pode criar até 2 contas de secretária.");
    }
    
    const newUser = { ...user, id: Math.random().toString(36).substr(2, 9) };
    users.push(newUser);
    setStorage(USERS_KEY, users);
    
    if (user.role === UserRole.DOCTOR_ADMIN && user.accountType && user.organizationName) {
        const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
        orgs.push({
            id: user.clinicId,
            accountType: user.accountType,
            name: user.organizationName,
            ownerUserId: newUser.id,
            maxDoctors: user.accountType === AccountType.CONSULTORIO ? 1 : 999
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

    const { password, accountType, organizationName, ...safeUser } = newUser;
    return safeUser;
  },

  deleteUser: async (id: string): Promise<void> => {
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    setStorage(USERS_KEY, users.filter(u => u.id !== id));
  },
  
  resetPassword: async (id: string, pass: string): Promise<void> => {
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const user = users.find(u => u.id === id);
    if (user) { user.password = pass; setStorage(USERS_KEY, users); }
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
    return settings.find(s => s.clinicId === clinicId) || { clinicId };
  },

  updateClinicSettings: async (newSettings: ClinicSettings): Promise<void> => {
    await delay(300);
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

    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doctor = doctors.find(d => d.id === appt.doctorId);
    const doctorName = doctor ? doctor.name : 'Clínica';

    n8nService.triggerWebhook('APPOINTMENT_CREATED', {
        ...newAppt,
        reason: appt.procedure,
        doctorName: doctorName
    }, 'Sending WhatsApp Confirmation');
    
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
        const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
        const doctor = doctors.find(d => d.id === created[0].doctorId);
        
        n8nService.triggerWebhook('AGENDA_BLOCKED', { 
            count: addedCount,
            doctorName: doctor?.name,
            date: created[0].date,
            clinicId: created[0].clinicId
        }, 'Updating calendars');
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
    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doctor = doctors.find(d => d.id === updatedAppt.doctorId);
    const doctorName = doctor ? doctor.name : 'Clínica';

    n8nService.triggerWebhook('STATUS_CHANGED', { 
        ...updatedAppt, 
        reason: updatedAppt.procedure,
        doctorName,
        oldStatus 
    }, 'Status Update Workflow');
    
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

  deleteAppointment: async (id: string): Promise<void> => {
    await delay(300);
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