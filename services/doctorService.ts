
import { Doctor, Organization, User, UserRole, AuditAction, AuditSource, DoctorAccessControl, AccountType } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, delay, initialDoctors, initialOrganizations, initialUsers, StoredUser } from './storage';
import { systemLogService } from './auditService';
import { passwordService } from './passwordService';
import { notificationService } from './notificationService';
import { socketServer, SocketEvent } from '../lib/socketServer';
import { sanitizeInput } from '../utils/sanitizer';

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
  
  // Retrieves ALL doctors for a clinic (Admin use mainly)
  getDoctors: async (clinicId: string): Promise<Doctor[]> => {
    await delay(200);
    const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
    return doctors.filter(d => d.organizationId === clinicId).map(doc => ({
        ...doc,
        // Migration fallback for old records
        accessControl: doc.accessControl || DoctorAccessControl.ALL,
        authorizedSecretaries: doc.authorizedSecretaries || []
    }));
  },

  /**
   * ✅ CORE SECURITY FUNCTION: 
   * Filter doctors based on logged-in user permissions.
   * This is the function used by the main App Context.
   */
  getDoctorsForUser: async (user: User): Promise<Doctor[]> => {
      // 1. Fetch all doctors for the user's organization
      const allDoctors = await doctorService.getDoctors(user.clinicId);
      
      // 2. Admin/Owner/Doctor_Admin sees EVERYTHING
      if (user.role === UserRole.OWNER || user.role === UserRole.DOCTOR_ADMIN) {
          return allDoctors;
      }

      // 3. Secretary Filtering
      if (user.role === UserRole.SECRETARY) {
          return allDoctors.filter(doc => {
              // Rule 1: 'ALL' means visible to all secretaries
              if (doc.accessControl === DoctorAccessControl.ALL) return true;
              
              // Rule 2: 'NONE' means private to doctor only (hidden from secretary)
              if (doc.accessControl === DoctorAccessControl.NONE) return false;
              
              // Rule 3: 'SELECTED' checks the specific Allow List
              if (doc.accessControl === DoctorAccessControl.SELECTED) {
                  return Array.isArray(doc.authorizedSecretaries) && doc.authorizedSecretaries.includes(user.id);
              }
              
              return false; // Default closed
          });
      }

      // Default: No access for unknown roles
      return [];
  },
  
  createDoctor: async (doctor: Omit<Doctor, 'id' | 'accessControl' | 'authorizedSecretaries'>): Promise<Doctor> => {
    await delay(300);
    const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
    
    const newDoctor: Doctor = { 
        ...doctor,
        // ✅ SECURITY FIX: Sanitize doctor details
        name: sanitizeInput(doctor.name),
        specialty: sanitizeInput(doctor.specialty),
        crm: sanitizeInput(doctor.crm),
        // GOVERNANCE: Use crypto.randomUUID()
        id: crypto.randomUUID(),
        accessControl: DoctorAccessControl.ALL, // Default open
        authorizedSecretaries: []
    };
    
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

  updateDoctorPermissions: async (doctorId: string, accessControl: DoctorAccessControl, authorizedSecretaries: string[]): Promise<Doctor> => {
      await delay(200);
      const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
      const index = doctors.findIndex(d => d.id === doctorId);
      
      if (index === -1) throw new Error("Médico não encontrado");

      const oldValues = { accessControl: doctors[index].accessControl, authorizedSecretaries: doctors[index].authorizedSecretaries };
      
      doctors[index] = {
          ...doctors[index],
          accessControl,
          authorizedSecretaries
      };
      
      setStorage(STORAGE_KEYS.DOCTORS, doctors);

      systemLogService.createLog({
        organizationId: doctors[index].organizationId,
        action: AuditAction.DOCTOR_UPDATED,
        entityType: 'Doctor',
        entityId: doctorId,
        entityName: doctors[index].name,
        description: `Atualizou permissões de acesso da agenda`,
        oldValues,
        newValues: { accessControl, authorizedSecretaries },
        source: AuditSource.WEB_APP
      });

      // Emit event so screens update immediately
      window.dispatchEvent(new Event('medflow:doctors-updated'));

      return doctors[index];
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
      
      // ✅ SECURITY ENFORCEMENT: Check Plan Limits
      if (user.role === UserRole.SECRETARY) {
          const orgs = getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations);
          const currentOrg = orgs.find(o => o.id === user.clinicId);
          
          if (currentOrg) {
              const currentSecretaries = users.filter(u => 
                  u.clinicId === user.clinicId && u.role === UserRole.SECRETARY
              ).length;
              
              const limit = currentOrg.accountType === AccountType.CLINICA ? 5 : 2;
              
              if (currentSecretaries >= limit) {
                  throw new Error(`Limite de secretárias atingido (${limit}) para o plano ${currentOrg.accountType}. Atualize seu plano para adicionar mais.`);
              }
          }
      }

      const plainPassword = user.password || '123456';
      const hashedPassword = await passwordService.hashPassword(plainPassword);

      const newUser: StoredUser = { 
        // GOVERNANCE: Use crypto.randomUUID()
        id: crypto.randomUUID(),
        name: sanitizeInput(user.name),
        username: sanitizeInput(user.username), // Sanitize username to prevent weird chars
        email: user.email, // Email validated by input type usually
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
              name: user.organizationName ? sanitizeInput(user.organizationName) : `Clínica ${newUser.name}`,
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

  updateUser: async (userId: string, updates: Partial<User> & { password?: string }): Promise<User> => {
      await delay(300);
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      const index = users.findIndex(u => u.id === userId);
      
      if (index === -1) throw new Error("Usuário não encontrado.");

      // Check unique username if changing
      if (updates.username && updates.username !== users[index].username) {
          if (users.some(u => u.username === updates.username && u.id !== userId)) {
              throw new Error("Este nome de usuário já está em uso.");
          }
      }

      // ✅ SECURITY FIX: Sanitize updates
      const safeUpdates = { ...updates };
      if (safeUpdates.name) safeUpdates.name = sanitizeInput(safeUpdates.name);
      if (safeUpdates.username) safeUpdates.username = sanitizeInput(safeUpdates.username);

      const updatedUser = { ...users[index], ...safeUpdates };

      // Handle password hashing if provided
      if (updates.password) {
          updatedUser.passwordHash = await passwordService.hashPassword(updates.password);
          delete (updatedUser as any).password; // Ensure raw password doesn't stick
      }

      users[index] = updatedUser;
      setStorage(STORAGE_KEYS.USERS, users);

      // If updating self, update session storage
      const currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || '{}');
      if (currentUser.id === userId) {
          const { passwordHash, ...safeSessionUser } = updatedUser;
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeSessionUser));
      }

      systemLogService.createLog({
          organizationId: updatedUser.clinicId,
          action: AuditAction.USER_CREATED, // Reuse or add UPDATED
          entityType: 'User',
          entityId: updatedUser.id,
          entityName: updatedUser.name,
          description: `Atualizou perfil do usuário: ${updatedUser.name}`,
          source: AuditSource.WEB_APP
      });

      const { passwordHash, ...safeUser } = updatedUser;
      return safeUser;
  },

  deleteUser: async (id: string): Promise<void> => {
     const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
     const user = users.find(u => u.id === id);
     
     if (!user) return;

     setStorage(STORAGE_KEYS.USERS, users.filter(u => u.id !== id));
     
     // Also remove Organization if user was an owner/client
     if (user.role === UserRole.DOCTOR_ADMIN) {
         let orgs = getStorage<Organization[]>(STORAGE_KEYS.ORGS, initialOrganizations);
         orgs = orgs.filter(o => o.id !== user.clinicId);
         setStorage(STORAGE_KEYS.ORGS, orgs);
     }

     // If secretary, remove them from all doctor's authorized lists
     if (user.role === UserRole.SECRETARY) {
         const doctors = getStorage<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
         let updatedDoctors = false;
         
         doctors.forEach(doc => {
             if (doc.authorizedSecretaries && doc.authorizedSecretaries.includes(id)) {
                 doc.authorizedSecretaries = doc.authorizedSecretaries.filter(secId => secId !== id);
                 updatedDoctors = true;
             }
         });
         
         if (updatedDoctors) {
             setStorage(STORAGE_KEYS.DOCTORS, doctors);
         }
     }
     
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
