
import { User, AuditAction, AuditSource, UserRole } from '../types';
import { STORAGE_KEYS, getStorage, setStorage, initialUsers, StoredUser, delay } from './storage';
import { passwordService } from './passwordService';
import { systemLogService } from './auditService';

export const authService = {
  login: async (username: string, pass: string): Promise<User | null> => {
      await delay(500);
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      const user = users.find(u => u.username === username);
      
      if (user) {
          // STRICT SECURITY: Delegate all verification to passwordService.
          const isValid = await passwordService.verifyPassword(pass, user.passwordHash);

          if (isValid) {
              // Migration Strategy: Upgrade to WebCrypto if needed
              if (passwordService.needsMigration(user.passwordHash)) {
                 try {
                     const newHash = await passwordService.hashPassword(pass);
                     user.passwordHash = newHash;
                     setStorage(STORAGE_KEYS.USERS, users);
                     
                     // ✅ AUDIT: Log successful migration
                     await systemLogService.createLog({
                         organizationId: user.clinicId,
                         action: AuditAction.PASSWORD_MIGRATION,
                         entityType: 'User',
                         entityId: user.id,
                         entityName: user.name,
                         description: 'Senha migrada para WebCrypto (PBKDF2/SHA-256)',
                         source: AuditSource.SYSTEM,
                         userId: user.id,
                         userName: user.name
                     });
                     console.log(`[AUTH] Migrated password for ${user.username} to WebCrypto`);
                 } catch (e: any) {
                     // 🚨 CRITICAL FAIL-SAFE: Prevent login if migration fails (Data Integrity)
                     console.error('[AUTH] Critical: Password migration failed', e);
                     
                     await systemLogService.createLog({
                         organizationId: user.clinicId,
                         action: AuditAction.SYSTEM_ERROR,
                         entityType: 'User',
                         entityId: user.id,
                         description: `CRITICAL: Password migration failed - ${e.message}`,
                         metadata: { error: e.stack },
                         source: AuditSource.SYSTEM
                     });
                     
                     throw new Error('SECURITY: Falha ao atualizar criptografia da senha. Contate o suporte.');
                 }
              }

              const { passwordHash, ...safeUser } = user;
              localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(safeUser));
              
              systemLogService.createLog({
                  organizationId: user.clinicId,
                  action: AuditAction.USER_LOGIN,
                  entityType: 'Session',
                  entityId: 'login',
                  description: 'Usuário realizou login',
                  userId: user.id,
                  userName: user.name,
                  source: AuditSource.WEB_APP
              });
              
              return safeUser;
          }
      }
      return null;
  },
  
  logout: async () => {
    const user = authService.getCurrentUser();
    if (user) {
        systemLogService.createLog({
            organizationId: user.clinicId,
            action: AuditAction.USER_LOGOUT,
            entityType: 'Session',
            entityId: 'logout',
            description: 'Usuário realizou logout',
            userId: user.id,
            userName: user.name,
            source: AuditSource.WEB_APP
        });
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },
  
  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return stored ? JSON.parse(stored) : null;
  },
  
  verifyPassword: async (pass: string): Promise<boolean> => {
      const currentUser = authService.getCurrentUser();
      if (!currentUser) return false;
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      const storedUser = users.find(u => u.id === currentUser.id);
      if (!storedUser) return false;
      
      return passwordService.verifyPassword(pass, storedUser.passwordHash);
  },

  /**
   * Verifica a senha Mestra (Super Admin / Owner).
   * Busca sempre a versão mais recente do usuário no storage para garantir
   * que se a senha do Dono mudar, a validação acompanha imediatamente.
   */
  verifyMasterPassword: async (pass: string): Promise<boolean> => {
      await delay(300);
      
      // Busca usuários atualizados do storage
      const users = getStorage<StoredUser[]>(STORAGE_KEYS.USERS, initialUsers);
      
      // Encontra o usuário que é DONO (Super Admin)
      const owner = users.find(u => u.role === UserRole.OWNER);
      
      if (!owner) {
          console.warn("[AUTH] Erro de Segurança: Conta de Dono não encontrada.");
          return false;
      }
      
      // STRICT SECURITY: Use standardized verification
      return passwordService.verifyPassword(pass, owner.passwordHash);
  }
};
