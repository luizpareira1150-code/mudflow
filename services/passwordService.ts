import bcrypt from 'bcryptjs';

export const passwordService = {
  /**
   * Hashes a plaintext password using bcrypt.
   * Uses 10 salt rounds for a balance between security and performance.
   */
  hashPassword: async (plainPassword: string): Promise<string> => {
    if (!plainPassword) throw new Error('Password cannot be empty');
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
  },

  /**
   * Verifies a plaintext password against a stored hash.
   */
  verifyPassword: async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    if (!plainPassword || !hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  /**
   * Helper to identify if a stored password is in legacy plaintext format.
   * This is used for the migration strategy.
   */
  needsMigration: (storedPassword: string): boolean => {
    // Bcrypt hashes start with $2a$ or $2b$
    return !storedPassword.startsWith('$2a$') && !storedPassword.startsWith('$2b$');
  }
};
