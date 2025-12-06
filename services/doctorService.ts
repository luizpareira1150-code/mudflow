
import { Doctor, Organization, User, UserRole, AuditAction, AuditSource } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialDoctors, initialOrganizations, initialUsers, StoredUser } from './storage';
import { systemLogService } from './auditService';
import { passwordService } from './passwordService';
import { notificationService } from './notificationService';
import { socketServer, SocketEvent } from '../lib/socketServer';

// Helper to avoid circular dependency
const getCurrentUserId = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        return stored ? JSON.parse(stored).id : 'system';
    } catch { return 'system'; }
};

export const doctorService = {
  getOrganizations: async (): Promise<Organization[]> => getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations),
  
  getOrganization: async (clinicId: string): Promise<Organization | null> => {
    const orgs = getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations);
    return orgs.find(o => o.id === clinicId) || null;
  },
  
  getDoctors: async (clinicId: string): Promise<Doctor[]> => {
    await delay(200);
    const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
    return doctors.filter(d => d.organizationId === clinicId);
  },
  
  createDoctor: async (doctor: Omit<Doctor, 'id'>): Promise<Doctor> => {
    await delay(300);
    const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
    const newDoctor = { ...doctor, id: `doc_${Date.now()}` };
    doctors.push(newDoctor);
    setStorage(STORAGE_KEYS.DOCTORS, doctors);
    
    systemLogService.createLog({
        organizationId: doctor.organizationId,
        action: AuditAction.DOCTOR_CREATED,
        entityType: 'Doctor',
        entityId: newDoctor.id,
        entityName: newDoctor.name,
        description: `Adicionou médico: ${newDoctor.name} (${newDoctor.specialty})`,
        source: AuditSource.WEB_APP
    });
    
    // Legacy event
    window.dispatchEvent(new Event('medflow:doctors-updated'));

    // ✅ WEBSOCKET EMIT
    socketServer.emit(
        SocketEvent.DOCTOR_CREATED,
        newDoctor,
        doctor.organizationId,
        getCurrentUserId()
    );
    
    return newDoctor;
  },
  
  deleteDoctor: async (doctorId: string): Promise<void> => {
      let doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
      const doc = doctors.find(d => d.id === doctorId);
      doctors = doctors.filter(d => d.id !== doctorId);
      setStorage(STORAGE_KEYS.DOCTORS, doctors);
      
      if (doc) {
        systemLogService.createLog({
            organizationId: doc.organizationId,
            action: AuditAction.DOCTOR_DELETED,
            entityType: 'Doctor',
            entityId: doc.id,
            entityName: doc.name,
            description: `Removeu médico: ${doc.name}`,
            oldValues: doc as any,
            source: AuditSource.WEB_APP
        });

        // ✅ WEBSOCKET EMIT
        socketServer.emit(
            SocketEvent.DOCTOR_DELETED,
            { id: doctorId, doctor: doc },
            doc.organizationId,
            getCurrentUserId()
        );
      }
      window.dispatchEvent(new Event('medflow:doctors-updated'));
  },

  getUsers: async (clinicId?: string): Promise<User[]> => {
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      const filtered = (clinicId && clinicId !== 'global') ? users.filter(u => u.clinicId === clinicId) : users;
      return filtered.map(({ passwordHash, ...u }) => u);
  },

  createUser: async (user: any): Promise<User> => {
      await delay(300);
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      if (users.some(u => u.username === user.username)) throw new Error("Nome de usuário já existe.");
      
      const plainPassword = user.password || '123456';
      const hashedPassword = await passwordService.hashPassword(plainPassword);

      const newUser: StoredUser = { 
        id: Math.random().toString(36).substr(2, 9),
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        phone1: user.phone1,
        phone2: user.phone2,
        passwordHash: hashedPassword
      };

      users.push(newUser);
      setStorage(STORAGE_KEYS.USERS, users);

      // CRITICAL: If creating a new Doctor Admin (Client), we must create the Organization record with the subscription value
      if (user.role === UserRole.DOCTOR_ADMIN) {
          const orgs = getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations);
          const newOrg: Organization = {
              id: user.clinicId,
              name: user.organizationName || `Clínica ${user.name}`,
              accountType: user.accountType,
              ownerUserId: newUser.id,
              maxDoctors: user.accountType === 'CLINICA' ? 5 : 1,
              subscriptionValue: user.subscriptionValue || 0
          };
          orgs.push(newOrg);
          setStorage(STORAGE_KEYS.ORGS, orgs);
      }
      
      systemLogService.createLog({
          organizationId: user.clinicId,
          action: AuditAction.USER_CREATED,
          entityType: 'User',
          entityId: newUser.id,
          entityName: newUser.name,
          description: `Criou usuário: ${newUser.name} (${newUser.role})`,
          source: AuditSource.WEB_APP
      });

      if (user.role === UserRole.SECRETARY) {
           notificationService.notify({
               title: 'Nova Secretária',
               message: `${newUser.name} foi adicionada à equipe.`,
               type: 'info',
               clinicId: user.clinicId,
               targetRole: [UserRole.DOCTOR_ADMIN],
               priority: 'low'
           });
      }

      const { passwordHash, ...safeUser } = newUser;

      // ✅ WEBSOCKET EMIT
      socketServer.emit(
        SocketEvent.USER_CREATED,
        safeUser,
        user.clinicId,
        getCurrentUserId()
      );

      return safeUser;
  },

  deleteUser: async (id: string): Promise<void> => {
     const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
     const user = users.find(u => u.id === id);
     setStorage(STORAGE_KEYS.USERS, users.filter(u => u.id !== id));
     
     // Also remove Organization if user was an owner/client
     if (user && user.role === UserRole.DOCTOR_ADMIN) {
         let orgs = getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations);
         orgs = orgs.filter(o => o.id !== user.clinicId);
         setStorage(STORAGE_KEYS.ORGS, orgs);
     }
     
     if (user) {
        systemLogService.createLog({
            organizationId: user.clinicId,
            action: AuditAction.USER_DELETED,
            entityType: 'User',
            entityId: user.id,
            entityName: user.name,
            description: `Removeu usuário: ${user.name}`,
            source: AuditSource.WEB_APP
        });

        // ✅ WEBSOCKET EMIT
        socketServer.emit(
            SocketEvent.USER_DELETED,
            { id, user },
            user.clinicId,
            getCurrentUserId()
        );
     }
  },

  resetPassword: async (id: string, pass: string): Promise<void> => {
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex >= 0) { 
        users[userIndex].passwordHash = await passwordService.hashPassword(pass);
        setStorage(STORAGE_KEYS.USERS, users); 
        
        systemLogService.createLog({
            organizationId: users[userIndex].clinicId,
            action: AuditAction.PASSWORD_RESET,
            entityType: 'User',
            entityId: id,
            entityName: users[userIndex].name,
            description: `Senha resetada pelo admin`,
            source: AuditSource.WEB_APP
        });
      }
  },
};
