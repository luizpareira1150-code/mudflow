import { Patient, PatientStatus, AuditAction, AuditSource } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialPatients } from './storage';
import { systemLogService } from './auditService';
import { normalizeCPF } from '../utils/cpfUtils';
import { normalizePhone } from '../utils/phoneUtils';

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
  
  createPatient: async (patient: any, source: AuditSource = AuditSource.WEB_APP): Promise<Patient> => {
      await delay(300);
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const newPatient: Patient = { ...patient, id: `pat_${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      patients.push(newPatient);
      setStorage(STORAGE_KEYS.PATIENTS, patients);
      
      systemLogService.createLog({
        organizationId: patient.organizationId,
        source: source,
        action: AuditAction.PATIENT_CREATED,
        entityType: 'Patient',
        entityId: newPatient.id,
        entityName: newPatient.name,
        description: `Cadastrou novo paciente: ${newPatient.name}`
      });
      
      return newPatient;
  },
  
  updatePatient: async (patientId: string, updates: Partial<Patient>): Promise<Patient> => {
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const index = patients.findIndex(p => p.id === patientId);
      if (index === -1) throw new Error("Paciente não encontrado");
      
      const oldValues = { ...patients[index] };
      patients[index] = { ...patients[index], ...updates, updatedAt: new Date().toISOString() };
      setStorage(STORAGE_KEYS.PATIENTS, patients);

      systemLogService.createLog({
        organizationId: patients[index].organizationId,
        action: AuditAction.PATIENT_UPDATED,
        entityType: 'Patient',
        entityId: patients[index].id,
        entityName: patients[index].name,
        description: `Atualizou dados do paciente`,
        oldValues: oldValues as any,
        newValues: updates as any,
        source: AuditSource.WEB_APP
      });

      return patients[index];
  },
  
  getOrCreatePatient: async (data: any, source: AuditSource = AuditSource.WEB_APP): Promise<Patient> => {
      const patients = getStorage<Patient[]>(STORAGE_KEYS.PATIENTS, initialPatients);
      const cleanPhone = normalizePhone(data.phone);
      const existing = patients.find(p => p.organizationId === data.organizationId && normalizePhone(p.phone) === cleanPhone);
      if (existing) return existing;
      return patientService.createPatient({ ...data, status: PatientStatus.Active }, source);
  },
};