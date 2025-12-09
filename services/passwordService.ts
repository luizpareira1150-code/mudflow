
// Configuration for Web Crypto PBKDF2
// UPGRADE: Increased from 100k to 600k iterations per OWASP 2024 recommendations for SHA-256
const PBKDF2_ITERATIONS = 600000; 
const PBKDF2_ALGO = 'SHA-256';
const SALT_SIZE = 16; // 16 bytes = 128 bits

export const passwordService = {
  /**
   * Hashes a plaintext password using the native Web Crypto API (PBKDF2).
   * This is asynchronous and runs on a separate thread, avoiding UI freeze.
   * Format: "v2:hexSalt:hexHash"
   */
  hashPassword: async (plainPassword: string): Promise<string> => {
    if (!plainPassword) throw new Error('Password cannot be empty');

    const encoder = new TextEncoder();
    const data = encoder.encode(plainPassword);
    
    // Generate random salt
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));

    // Import password as key material
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', 
      data, 
      { name: 'PBKDF2' }, 
      false, 
      ['deriveBits', 'deriveKey']
    );

    // Derive the key (hash)
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: PBKDF2_ALGO
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // Export key to get the raw bytes
    const exportedKey = await window.crypto.subtle.exportKey('raw', derivedKey);
    const hashBuffer = new Uint8Array(exportedKey);

    // Convert buffers to hex strings
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

    return `v2:${saltHex}:${hashHex}`;
  },

  /**
   * Verifies a plaintext password against a stored hash.
   * Supports:
   * 1. New WebCrypto (starts with v2:)
   * 2. Seed Token (Migration only)
   * 
   * NOTE: Legacy bcryptjs support has been removed for performance.
   */
  verifyPassword: async (plainPassword: string, storedHash: string): Promise<boolean> => {
    if (!plainPassword || !storedHash) return false;

    // SEED DATA SUPPORT (Temporary for Migration)
    // Used for initial mock users (admin, medicocli, etc.)
    if (storedHash === '$SEED$123' && plainPassword === '123') return true;

    // 1. Check for WebCrypto Format "v2:salt:hash"
    if (storedHash.startsWith('v2:')) {
        try {
            const parts = storedHash.split(':');
            if (parts.length !== 3) return false;
            const saltHex = parts[1];
            const originalHashHex = parts[2];

            // Convert hex salt back to Uint8Array
            const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

            const encoder = new TextEncoder();
            const data = encoder.encode(plainPassword);

            // Re-run derivation with exact same parameters
            const keyMaterial = await window.crypto.subtle.importKey(
                'raw', 
                data, 
                { name: 'PBKDF2' }, 
                false, 
                ['deriveBits', 'deriveKey']
            );

            const derivedKey = await window.crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: saltBytes,
                    iterations: PBKDF2_ITERATIONS,
                    hash: PBKDF2_ALGO
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            const exportedKey = await window.crypto.subtle.exportKey('raw', derivedKey);
            const hashBuffer = new Uint8Array(exportedKey);
            const newHashHex = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');

            return newHashHex === originalHashHex;
        } catch (e) {
            console.error('WebCrypto Verification Error:', e);
            return false;
        }
    }

    // Fallback: If hash is not v2 and not seed, it might be an old bcrypt hash.
    // Since we removed the library, we treat it as invalid to enforce security upgrade.
    return false;
  },

  /**
   * Helper to identify if a stored password uses the new high-performance format.
   * Used for gradual migration of users on login.
   */
  needsMigration: (storedPassword: string): boolean => {
    // If it's not v2, it needs migration (including SEED tokens)
    return !storedPassword.startsWith('v2:');
  }
};
