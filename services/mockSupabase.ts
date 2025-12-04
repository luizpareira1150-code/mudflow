
import { User, UserRole, Appointment, AppointmentStatus, AgendaConfig, ClinicSettings, Doctor, AvailableSlot, Organization, AccountType, ClientHealthMetrics, GlobalMetrics, Patient, PatientStatus } from '../types';
import { N8NIntegrationService, N8NOutgoingPayload, generateApiToken } from './n8nIntegration';
import { passwordService } from './passwordService';
import { normalizeCPF } from '../utils/cpfUtils';
import { normalizePhone } from '../utils/phoneUtils';

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

// Initial Users
const initialUsers: StoredUser[] = [
  { id: 'user_owner', name: 'Super Admin', username: 'admin', passwordHash: 'PLAIN:123', email: 'admin@medflow.com', role: UserRole.OWNER, clinicId: 'global' },
  { id: 'user_med_cli', name: 'Dr. Diretor', username: 'medicocli', passwordHash: 'PLAIN:123', email: 'diretor@clinica.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CLINICA_ID },
  { id: 'user_sec', name: 'Secretária Ana', username: 'secretaria', passwordHash: 'PLAIN:123', email: 'ana@clinica.com', role: UserRole.SECRETARY, clinicId: ORG_CLINICA_ID },
  { id: 'user_med_con', name: 'Dr. Roberto Solo', username: 'medicocon', passwordHash: 'PLAIN:123', email: 'roberto@consultorio.com', role: UserRole.DOCTOR_ADMIN, clinicId: ORG_CONSULTORIO_ID },
];

const initialDoctors: Doctor[] = [
  { id: 'doc_cli_1', organizationId: ORG_CLINICA_ID, name: 'Dr. Diretor (Cardio)', specialty: 'Cardiologia', color: 'blue' },
  { id: 'doc_cli_2', organizationId: ORG_CLINICA_ID, name: 'Dra. Julia (Derma)', specialty: 'Dermatologia', color: 'purple' },
  { id: 'doc_cli_3', organizationId: ORG_CLINICA_ID, name: 'Dr. Pedro (Geral)', specialty: 'Clínico Geral', color: 'green' },
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

// INITIAL PATIENTS MOCK
const initialPatients: Patient[] = [
    {
        id: 'pat_1',
        organizationId: ORG_CLINICA_ID,
        name: 'João da Silva',
        phone: '11999990001',
        email: 'joao@email.com',
        status: PatientStatus.Active,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

// INITIAL APPOINTMENTS MOCK
const initialAppointments: Appointment[] = [
  { 
    id: 'appt_1', 
    clinicId: ORG_CLINICA_ID, 
    doctorId: 'doc_cli_1',
    slotId: 'slot_1',
    patientId: 'pat_1', // Linked to initialPatients[0]
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
const PATIENTS_KEY = 'medflow_patients'; 
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

// --- SERVICES ---

// 1. Password Migration
const migratePasswords = async () => {
  const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
  let hasChanges = false;
  
  const updatedUsers = await Promise.all(users.map(async (u) => {
    if (u.passwordHash && u.passwordHash.startsWith('PLAIN:')) {
      const plain = u.passwordHash.replace('PLAIN:', '');
      u.passwordHash = await passwordService.hashPassword(plain);
      hasChanges = true;
      return u;
    }
    return u;
  }));

  if (hasChanges) {
    setStorage(USERS_KEY, updatedUsers);
  }
};
migratePasswords();

// --- N8N SIMULATION SERVICE ---
export const n8nService = {
  triggerWebhook: async (
    event: N8NOutgoingPayload['event'],
    data: any,
    description: string
  ) => {
    const clinicId = data.clinicId || 'global';
    const settingsList = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    const settings = settingsList.find(s => s.clinicId === clinicId);
    if (!settings) return;
    
    const doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doctor = doctors.find(d => d.id === data.doctorId) || doctors[0];
    const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
    const org = orgs.find(o => o.id === clinicId);

    // Look up patient details if ID is present
    let patientDetails = { name: data.patientName, phone: data.patientPhone };
    if (data.patientId && !data.patientName) {
         const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
         const p = patients.find(pat => pat.id === data.patientId);
         if (p) patientDetails = { name: p.name, phone: p.phone };
    }
    
    const payload: N8NOutgoingPayload = {
      event,
      data: {
        appointmentId: data.id,
        patientName: patientDetails.name,
        patientPhone: patientDetails.phone,
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
    await N8NIntegrationService.sendToN8N(payload, settings);
  }
};

// --- DATA SERVICE ---

export const dataService = {
  // === ORGANIZATIONS ===
  getOrganizations: async (): Promise<Organization[]> => {
      return getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
  },
  getOrganization: async (clinicId: string): Promise<Organization | null> => {
    const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
    return orgs.find(o => o.id === clinicId) || null;
  },

  // === DOCTORS ===
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
    window.dispatchEvent(new Event('medflow:doctors-updated'));
    return newDoctor;
  },
  deleteDoctor: async (doctorId: string): Promise<void> => {
    await delay(300);
    let doctors = getStorage<Doctor[]>(DOCTORS_KEY, initialDoctors);
    const doc = doctors.find(d => d.id === doctorId);
    doctors = doctors.filter(d => d.id !== doctorId);
    setStorage(DOCTORS_KEY, doctors);
    
    let appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    appts = appts.filter(a => a.doctorId !== doctorId);
    setStorage(APPOINTMENTS_KEY, appts);
    
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
    window.dispatchEvent(new Event('medflow:doctors-updated'));
  },

  // === USERS ===
  getUsers: async (clinicId?: string): Promise<User[]> => {
    await delay(300);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const filtered = (clinicId && clinicId !== 'global') ? users.filter(u => u.clinicId === clinicId) : users;
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
    
    const plainPassword = user.password || '123456';
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

  // === AGENDA CONFIGURATION ===
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
    const index = configs.findIndex(c => c.clinicId === newConfig.clinicId && c.doctorId === newConfig.doctorId);
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
        clinicSetting = { clinicId, clinicToken: `clinic_${Date.now()}` };
        settings.push(clinicSetting);
        setStorage(CLINIC_SETTINGS_KEY, settings);
    }
    return clinicSetting;
  },
  updateClinicSettings: async (newSettings: ClinicSettings): Promise<void> => {
    await delay(300);
    if (!newSettings.apiToken) {
      newSettings.apiToken = generateApiToken(newSettings.clinicId);
    }
    let settings = getStorage<ClinicSettings[]>(CLINIC_SETTINGS_KEY, initialSettings);
    const index = settings.findIndex(s => s.clinicId === newSettings.clinicId);
    if (index >= 0) settings[index] = newSettings;
    else settings.push(newSettings);
    setStorage(CLINIC_SETTINGS_KEY, settings);
  },

  // === PATIENTS SERVICE (NEW) ===
  
  // List all patients for a clinic
  getAllPatients: async (clinicId: string): Promise<Patient[]> => {
    await delay(200);
    const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
    return patients.filter(p => p.organizationId === clinicId);
  },
  
  // Get single patient by ID
  getPatientById: async (patientId: string): Promise<Patient | undefined> => {
    const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
    return patients.find(p => p.id === patientId);
  },
  
  // Get single patient by CPF (Validated)
  getPatientByCPF: async (cpf: string, organizationId: string): Promise<Patient | undefined> => {
      const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
      const cleanCPF = normalizeCPF(cpf);
      return patients.find(p => p.organizationId === organizationId && p.cpf && normalizeCPF(p.cpf) === cleanCPF);
  },

  // Search logic (used by PatientSelector)
  searchPatients: async (searchTerm: string, organizationId: string): Promise<Patient[]> => {
      await delay(150);
      const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
      const lowerTerm = searchTerm.toLowerCase();
      const cleanTerm = lowerTerm.replace(/\D/g, '');
      
      return patients.filter(p => 
          p.organizationId === organizationId && (
            p.name.toLowerCase().includes(lowerTerm) ||
            (cleanTerm.length > 3 && p.phone.includes(cleanTerm)) ||
            (p.cpf && cleanTerm.length > 3 && p.cpf.replace(/\D/g, '').includes(cleanTerm))
          )
      );
  },

  // Create Patient (with Validation)
  createPatient: async (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Patient> => {
      await delay(300);
      const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
      
      // 1. Validate CPF Uniqueness
      if (patient.cpf) {
          const cleanCPF = normalizeCPF(patient.cpf);
          const existing = patients.find(p => 
            p.organizationId === patient.organizationId && 
            p.cpf && 
            normalizeCPF(p.cpf) === cleanCPF
          );
          if (existing) throw new Error(`Já existe um paciente com este CPF: ${existing.name}`);
      }
      
      const newPatient: Patient = {
          ...patient,
          id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          status: PatientStatus.Active,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      
      patients.push(newPatient);
      setStorage(PATIENTS_KEY, patients);
      return newPatient;
  },
  
  // Update Patient
  updatePatient: async (patientId: string, updates: Partial<Patient>): Promise<Patient> => {
      const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
      const index = patients.findIndex(p => p.id === patientId);
      if (index === -1) throw new Error("Paciente não encontrado");
      
      // Validate CPF change
      if (updates.cpf) {
          const cleanCPF = normalizeCPF(updates.cpf);
          const currentOrg = patients[index].organizationId;
          const existing = patients.find(p => 
             p.organizationId === currentOrg && 
             p.id !== patientId && 
             p.cpf && 
             normalizeCPF(p.cpf) === cleanCPF
          );
          if (existing) throw new Error("Este CPF já pertence a outro paciente.");
      }
      
      patients[index] = { ...patients[index], ...updates, updatedAt: new Date().toISOString() };
      setStorage(PATIENTS_KEY, patients);
      return patients[index];
  },

  // Main Logic for Import/Integrations: Find existing or Create new
  getOrCreatePatient: async (data: { name: string; phone: string; cpf?: string; organizationId: string }): Promise<Patient> => {
      const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
      const cleanPhone = normalizePhone(data.phone);
      const cleanCPF = data.cpf ? normalizeCPF(data.cpf) : undefined;

      // 1. Try Find by CPF (Strongest Match)
      if (cleanCPF) {
          const existing = patients.find(p => p.organizationId === data.organizationId && p.cpf && normalizeCPF(p.cpf) === cleanCPF);
          if (existing) {
              return existing;
          }
      }

      // 2. Try Find by Phone (Fallback Match)
      const existingByPhone = patients.find(p => p.organizationId === data.organizationId && normalizePhone(p.phone) === cleanPhone);
      if (existingByPhone) {
          // If provided CPF but record has none, update it
          if (cleanCPF && !existingByPhone.cpf) {
              existingByPhone.cpf = data.cpf;
              setStorage(PATIENTS_KEY, patients);
          }
          return existingByPhone;
      }

      // 3. Create New
      return dataService.createPatient({
          name: data.name,
          phone: data.phone,
          cpf: data.cpf,
          organizationId: data.organizationId,
          status: PatientStatus.Active
      });
  },

  // === APPOINTMENTS SERVICE ===
  
  // Get Slots with JOINED Patient Data
  getAvailableSlots: async (clinicId: string, doctorId: string, date: string): Promise<AvailableSlot[]> => {
    await delay(300);
    const config = await dataService.getAgendaConfig(clinicId, doctorId);
    
    // Fetch appointments and join patients
    const allAppts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const allPatients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
    
    // Filter appointments for this day/doctor, excluding 'Did Not Show' to allow rebooking if needed (optional logic)
    // Actually, usually blocked slots and active appointments occupy space.
    const doctorAppts = allAppts
        .filter(a => a.clinicId === clinicId && a.doctorId === doctorId && a.date === date && a.status !== AppointmentStatus.NAO_VEIO)
        .map(a => ({
            ...a,
            // runtime join
            patient: allPatients.find(p => p.id === a.patientId)
        }));

    const slots: AvailableSlot[] = [];
    const [startH, startM] = config.startHour.split(':').map(Number);
    const [endH, endM] = config.endHour.split(':').map(Number);
    let current = new Date(); current.setHours(startH, startM, 0, 0);
    const end = new Date(); end.setHours(endH, endM, 0, 0);

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

  // Get Appointments with JOINED Patient Data
  getAppointments: async (clinicId: string, date: string, doctorId?: string): Promise<Appointment[]> => {
    await delay(200);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const patients = getStorage<Patient[]>(PATIENTS_KEY, initialPatients);
    
    let filtered = appts.filter(a => a.clinicId === clinicId && a.date === date);
    if (doctorId) filtered = filtered.filter(a => a.doctorId === doctorId);
    
    // JOIN Patient Data
    return filtered.map(a => ({
        ...a,
        patient: patients.find(p => p.id === a.patientId)
    }));
  },

  // Create Appointment (Now requires patientId)
  createAppointment: async (appt: Omit<Appointment, 'id' | 'patient'>): Promise<Appointment> => {
    await delay(300);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    
    // Check conflict
    const exists = appts.some(a => a.clinicId === appt.clinicId && a.doctorId === appt.doctorId && a.date === appt.date && a.time === appt.time && a.status !== AppointmentStatus.NAO_VEIO);
    if (exists) throw new Error("Horário já ocupado para este médico!");
    
    // Validate Patient ID
    const patient = await dataService.getPatientById(appt.patientId);
    if (!patient) throw new Error("Paciente não encontrado. Crie o cadastro primeiro.");
    
    const newAppt = { ...appt, id: Math.random().toString(36).substr(2, 9) };
    appts.push(newAppt);
    setStorage(APPOINTMENTS_KEY, appts);
    
    n8nService.triggerWebhook('APPOINTMENT_CREATED', { 
        ...newAppt, 
        reason: appt.procedure, 
        patientName: patient?.name,
        patientPhone: patient?.phone
    }, 'Appointment Created');
    
    return newAppt;
  },

  createBatchAppointments: async (newAppts: Omit<Appointment, 'id'>[]): Promise<void> => {
    await delay(400);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    const created = newAppts.map(a => ({ ...a, id: Math.random().toString(36).substr(2, 9) }));
    
    let addedCount = 0;
    created.forEach(newItem => {
        const exists = appts.some(old => old.clinicId === newItem.clinicId && old.doctorId === newItem.doctorId && old.date === newItem.date && old.time === newItem.time && old.status !== AppointmentStatus.NAO_VEIO);
        if (!exists) { appts.push(newItem); addedCount++; }
    });
    setStorage(APPOINTMENTS_KEY, appts);
    
    if (created.length > 0) {
        n8nService.triggerWebhook('AGENDA_BLOCKED', { count: addedCount, doctorId: created[0].doctorId, date: created[0].date, clinicId: created[0].clinicId }, 'Agenda Blocked');
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
    const patient = await dataService.getPatientById(updatedAppt.patientId);
    
    n8nService.triggerWebhook('STATUS_CHANGED', { 
        ...updatedAppt, 
        reason: updatedAppt.procedure, 
        oldStatus,
        patientName: patient?.name,
        patientPhone: patient?.phone
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
      const isBooked = appts.some(a => a.id !== updatedAppt.id && a.clinicId === updatedAppt.clinicId && a.doctorId === updatedAppt.doctorId && a.date === updatedAppt.date && a.time === updatedAppt.time && a.status !== AppointmentStatus.NAO_VEIO);
      if (isBooked) throw new Error("Conflito! Horário ocupado para este médico.");
    }
    
    // Preserve Patient ID, update fields
    appts[index] = { ...currentAppt, ...updatedAppt };
    setStorage(APPOINTMENTS_KEY, appts);
    return updatedAppt;
  },

  deleteAppointment: async (id: string, reason?: string): Promise<void> => {
    await delay(300);
    const appts = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
    setStorage(APPOINTMENTS_KEY, appts.filter(a => a.id !== id));
  },

  // Subscriptions
  subscribeToAgendaSlots: (clinicId: string, doctorId: string, date: string, onUpdate: (slots: AvailableSlot[]) => void) => {
    dataService.getAvailableSlots(clinicId, doctorId, date).then(onUpdate);
    const interval = setInterval(async () => {
      const slots = await dataService.getAvailableSlots(clinicId, doctorId, date);
      onUpdate(slots);
    }, 3000);
    return () => clearInterval(interval);
  },

  subscribeToAppointments: (clinicId: string, date: string, doctorId: string, onUpdate: (appts: Appointment[]) => void) => {
    dataService.getAppointments(clinicId, date, doctorId).then(onUpdate);
    const interval = setInterval(async () => {
      const appts = await dataService.getAppointments(clinicId, date, doctorId);
      onUpdate(appts);
    }, 3000);
    return () => clearInterval(interval);
  }
};

export const analyticsService = {
  getOwnerDashboardMetrics: async (): Promise<{ global: GlobalMetrics, clients: ClientHealthMetrics[] }> => {
    await delay(600);
    const orgs = getStorage<Organization[]>(ORGS_KEY, initialOrganizations);
    const activeOrgs = orgs.filter(o => o.id !== 'global');
    
    const clientsMetrics: ClientHealthMetrics[] = activeOrgs.map((org) => {
      const today = new Date();
      const seed = org.id.length + org.name.length;
      
      const monthlyScheduled = Math.floor((seed * 15) % 300) + 50; 
      const monthlyAttended = Math.floor(monthlyScheduled * 0.85);
      const monthlyCancelled = monthlyScheduled - monthlyAttended;
      const weeklyScheduled = Math.floor(monthlyScheduled / 4);
      const weeklyAttended = Math.floor(weeklyScheduled * 0.9);
      
      const lastUsedDays = Math.floor((seed * 7) % 20);
      const lastUsed = new Date(today);
      lastUsed.setDate(today.getDate() - lastUsedDays);
      
      let healthScore: 'healthy' | 'attention' | 'risk' = 'healthy';
      if (lastUsedDays > 10 || monthlyScheduled < 30) healthScore = 'risk';
      else if (lastUsedDays > 3 || monthlyScheduled < 50) healthScore = 'attention';
      
      const occupancyRate = Math.min(100, (monthlyScheduled / (30 * 8)) * 100);

      return {
        clientId: org.id,
        clientName: org.name,
        accountType: org.accountType === AccountType.CLINICA ? 'CLINICA' : 'CONSULTORIO',
        lastUsed: lastUsed.toISOString(),
        appointmentsThisMonth: monthlyScheduled,
        appointmentsThisWeek: weeklyScheduled,
        automationsActive: seed % 2 !== 0,
        webhookStatus: seed % 3 === 0 ? 'warning' : 'healthy',
        healthScore,
        weeklyContacts: Math.floor(weeklyScheduled * 1.2),
        weeklyScheduled,
        weeklyAttended,
        weeklyCancelled: weeklyScheduled - weeklyAttended,
        monthlyContacts: Math.floor(monthlyScheduled * 1.15),
        monthlyScheduled,
        monthlyAttended,
        monthlyCancelled,
        growthVsLastMonth: Math.floor((seed % 40) - 10),
        avgAppointmentsPerDay: parseFloat((monthlyScheduled / 30).toFixed(1)),
        availableSlots: 240,
        occupancyRate: parseFloat(occupancyRate.toFixed(1)),
        noShowRate: parseFloat(((monthlyCancelled / monthlyScheduled) * 100).toFixed(1)),
        needsTrafficAnalysis: occupancyRate < 60
      };
    });

    const globalMetrics: GlobalMetrics = {
      totalClients: activeOrgs.length,
      activeClients: clientsMetrics.filter(m => m.healthScore !== 'risk').length,
      totalAppointmentsThisMonth: clientsMetrics.reduce((sum, m) => sum + m.monthlyScheduled, 0),
      totalAutomationsSent: Math.floor(clientsMetrics.reduce((sum, m) => sum + m.monthlyScheduled, 0) * 3.5),
      automationSuccessRate: 97.8,
      mrr: activeOrgs.length * 150,
      growthRate: 18.5
    };

    return { global: globalMetrics, clients: clientsMetrics };
  }
};

export const authService = {
  login: async (username: string, password: string): Promise<User | null> => {
    await delay(500);
    const users = getStorage<StoredUser[]>(USERS_KEY, initialUsers);
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user && user.passwordHash) {
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

// --- AUTOMATIC MIGRATION SCRIPT ---
// This runs once to convert legacy Appointment structures (with name/phone) 
// to the new Relational structure (patientId).
const migrateExistingAppointments = async () => {
  const appointments = getStorage<Appointment[]>(APPOINTMENTS_KEY, initialAppointments);
  let hasChanges = false;
  
  for (const appt of appointments) {
    // Check if it's a legacy appointment (has name but missing/broken ID linkage)
    // Note: Our types.ts defines patientName as optional now, but in raw storage it might exist.
    if ((appt as any).patientName && (appt as any).patientPhone && !appt.patientId) {
       console.log(`[MIGRATION] Migrating appointment ${appt.id}...`);
       
       const patient = await dataService.getOrCreatePatient({
           name: (appt as any).patientName,
           phone: (appt as any).patientPhone,
           organizationId: appt.clinicId
       });
       
       appt.patientId = patient.id;
       delete (appt as any).patientName;
       delete (appt as any).patientPhone;
       hasChanges = true;
    } 
    // Case 2: Has patientId but it points to nothing (legacy Mock data)
    else if (appt.patientId) {
        const patientExists = await dataService.getPatientById(appt.patientId);
        if (!patientExists && (appt as any).patientName) {
            // Re-create the missing patient
            const patient = await dataService.createPatient({
                id: appt.patientId, // Keep ID if possible or generate new? Let's use old ID to maintain consistency
                name: (appt as any).patientName || 'Paciente Migrado',
                phone: (appt as any).patientPhone || '',
                organizationId: appt.clinicId,
                status: PatientStatus.Active,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            } as any);
        }
    }
  }
  
  if (hasChanges) {
    setStorage(APPOINTMENTS_KEY, appointments);
    console.log('[MIGRATION] Appointments migrated to new Patient structure.');
  }
};
// Run migration
setTimeout(migrateExistingAppointments, 1000);

export const webhookService = {
  receiveFromN8N: async (payload: { action: 'CREATE_APPOINTMENT' | 'UPDATE_STATUS' | 'BLOCK_SCHEDULE' | 'CREATE_PATIENT_CONTACT'; data: any; clinicId: string; authToken: string; }) => {
    await delay(200);
    const settings = await dataService.getClinicSettings(payload.clinicId);
    const validTokens = new Map<string, string>();
    if (settings.apiToken) validTokens.set(payload.clinicId, settings.apiToken);
    if (!settings.apiToken && settings.clinicToken) validTokens.set(payload.clinicId, settings.clinicToken);
    return await N8NIntegrationService.receiveFromN8N(payload as any, validTokens, dataService);
  }
};
