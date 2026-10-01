import crypto from 'crypto';

/**
 * Valida que la contraseña cumpla con la regla:
 * Mínimo 6 caracteres.
 */
export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  return password.trim().length >= 6;
}

/**
 * Genera un hash criptográfico seguro usando crypto.scryptSync nativo de Node.js.
 * Retorna formato: "salt:hashHex"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Compara y verifica una contraseña en texto plano contra el hash almacenado.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || typeof storedHash !== 'string') return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
