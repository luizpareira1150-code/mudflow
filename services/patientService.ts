
import { Patient, PatientStatus, AuditAction, AuditSource, User, UserRole } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialPatients } from './storage';
import { systemLogService } from './auditService';
import { normalizeCPF } from '../utils/cpfUtils';
import { normalizePhone } from '../utils/phoneUtils';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { sanitizeInput } from '../utils/sanitizer';

// Helper to avoid circular dependency
const getCurrentUserId = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return stored ? JSON.parse(stored).id : 'system';
    } catch { return 'system'; }
};

const validateAuthorization = (actingUser: User, targetClinicId: string) => {
    if (actingUser.role === UserRole.OWNER) return; // Super Admin bypass
    if (actingUser.clinicId !== targetClinicId) {
        throw new Error(`SECURITY_VIOLATION: User ${actingUser.username} attempted to modify resource in unauthorized clinic ${targetClinicId}.`);
    }
};

export const patientService = {
  getAllPatients: async (clinicId: string): Promise<Patient[]> => {
      await delay(200);
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      return patients.filter(p => p.organizationId === clinicId);
  },
  
  getPatientById: async (patientId: string): Promise<Patient | undefined> => {
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      return patients.find(p => p.id === patientId);
  },
  
  getPatientByCPF: async (cpf: string, organizationId: string): Promise<Patient | undefined> => {
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const cleanCPF = normalizeCPF(cpf);
      return patients.find(p => p.organizationId === organizationId && p.cpf && normalizeCPF(p.cpf) === cleanCPF);
  },
  
  searchPatients: async (searchTerm: string, organizationId: string): Promise<Patient[]> => {
      await delay(150);
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const lowerTerm = searchTerm.toLowerCase();
      const cleanTerm = lowerTerm.replace(/\D/g, '');
      return patients.filter(p => p.organizationId === organizationId && (p.name.toLowerCase().includes(lowerTerm) || (cleanTerm.length > 3 && p.phone.includes(cleanTerm))));
  },
  
  createPatient: async (patient: any, source: AuditSource = AuditSource.WEB_APP, actingUser: User): Promise<Patient> => {
      await delay(300);
      
      // Security Check
      validateAuthorization(actingUser, patient.organizationId);

      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const newPatient: Patient = { 
          ...patient,
          // ✅ SECURITY FIX: Explicitly sanitize strings
          name: sanitizeInput(patient.name),
          notes: sanitizeInput(patient.notes),
          condition: sanitizeInput(patient.condition),
          // GOVERNANCE: Use crypto.randomUUID()
          id: crypto.randomUUID(), 
          createdAt: new Date().toISOString(), 
          updatedAt: new Date().toISOString() 
      };
      patients.push(newPatient);
      setStorage(STORAGE_KEYS.PATIENTS, patients);
      
      systemLogService.createLog({
        organizationId: patient.organizationId,
        source: source,
        action: AuditAction.PATIENT_CREATED,
        entityType: 'Patient',
        entityId: newPatient.id,
        entityName: newPatient.name,
        description: `Cadastrou novo paciente: ${newPatient.name}`,
        userId: actingUser.id,
        userName: actingUser.name
      });

      // ✅ WEBSOCKET EMIT
      socketServer.emit(
        SocketEvent.PATIENT_CREATED,
        newPatient,
        patient.organizationId,
        getCurrentUserId()
      );
      
      return newPatient;
  },
  
  updatePatient: async (patientId: string, updates: Partial<Patient>, actingUser: User): Promise<Patient> => {
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const index = patients.findIndex(p => p.id === patientId);
      if (index === -1) throw new Error("Paciente não encontrado");
      
      const targetClinicId = patients[index].organizationId;
      
      // Security Check
      validateAuthorization(actingUser, targetClinicId);

      // ✅ SECURITY FIX: Sanitize updates
      const safeUpdates = { ...updates };
      if (safeUpdates.name) safeUpdates.name = sanitizeInput(safeUpdates.name);
      if (safeUpdates.notes) safeUpdates.notes = sanitizeInput(safeUpdates.notes);
      if (safeUpdates.condition) safeUpdates.condition = sanitizeInput(safeUpdates.condition);

      const oldValues = { ...patients[index] };
      patients[index] = { ...patients[index], ...safeUpdates, updatedAt: new Date().toISOString() };
      setStorage(STORAGE_KEYS.PATIENTS, patients);

      systemLogService.createLog({
        organizationId: targetClinicId,
        action: AuditAction.PATIENT_UPDATED,
        entityType: 'Patient',
        entityId: patients[index].id,
        entityName: patients[index].name,
        description: `Atualizou dados do paciente`,
        oldValues: oldValues as any,
        newValues: safeUpdates as any,
        source: AuditSource.WEB_APP,
        userId: actingUser.id,
        userName: actingUser.name
      });

      // ✅ WEBSOCKET EMIT
      socketServer.emit(
        SocketEvent.PATIENT_UPDATED,
        patients[index],
        patients[index].organizationId,
        getCurrentUserId()
      );

      return patients[index];
  },
  
  getOrCreatePatient: async (data: any, source: AuditSource = AuditSource.WEB_APP, actingUser: User): Promise<Patient> => {
      // Security Check
      validateAuthorization(actingUser, data.organizationId);

      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const cleanPhone = normalizePhone(data.phone);
      const existing = patients.find(p => p.organizationId === data.organizationId && normalizePhone(p.phone) === cleanPhone);
      if (existing) return existing;
      return patientService.createPatient({ ...data, status: PatientStatus.Active }, source, actingUser);
  },
};
