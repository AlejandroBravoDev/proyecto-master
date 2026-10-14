/**
 * ====================================================
 * UTILIDADES DE JWT (SESIONES SIN ESTADO)
 * ====================================================
 * Emisión y verificación de los tokens de acceso del POS.
 *
 * - Firma y verificación SIEMPRE con HS256 explícito (nunca se acepta `alg: none` ni otro algoritmo).
 * - La configuración se lee del entorno EN CADA USO (no al importar el módulo), de modo que las
 *   pruebas pueden cambiarla:
 *     JWT_SECRET       secreto de firma (mínimo recomendado: 32 caracteres). Si falta se genera uno
 *                      aleatorio por arranque (las sesiones se pierden al reiniciar) y se avisa.
 *     JWT_EXPIRES_IN   vigencia del token (por defecto 12h). Número = segundos; texto con unidad
 *                      ("30m", "12h", "7d").
 * - Contenido del token: `sub` (id del usuario), `role` (solo informativo: el servidor vuelve a leer
 *   el rol de la BD en cada petición) y `pv` (huella corta del hash de la contraseña, para que un
 *   cambio de contraseña invalide los tokens anteriores sin tocar el esquema).
 */

import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { parseId } from './http.utils';

/** Único algoritmo permitido para firmar y verificar. */
export const JWT_ALGORITHM = 'HS256' as const;

/** Vigencia por defecto del token. */
export const DEFAULT_JWT_EXPIRES_IN = '12h';

/** Longitud mínima recomendada del secreto: por debajo se avisa, pero se usa igualmente. */
export const MIN_JWT_SECRET_LENGTH = 32;

/** Secreto aleatorio de este proceso, usado solo cuando JWT_SECRET no está definida. */
let generatedSecret: string | null = null;

/** Avisos ya emitidos (cada uno sale una sola vez por proceso para no inundar el log). */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Solo para pruebas: olvida el secreto generado y los avisos ya emitidos. */
export function resetJwtStateForTests(): void {
  generatedSecret = null;
  warned.clear();
}

/**
 * Secreto de firma.
 * - JWT_SECRET definida y no vacía: se usa (con aviso si tiene menos de 32 caracteres).
 * - Ausente o vacía: se genera uno aleatorio de 64 bytes que vive hasta que el proceso termina,
 *   con un aviso claro (no se avisa con NODE_ENV=test).
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.JWT_SECRET;

  if (configured !== undefined && configured.trim() !== '') {
    if (configured.length < MIN_JWT_SECRET_LENGTH) {
      warnOnce(
        'short-secret',
        `[Seguridad] JWT_SECRET tiene solo ${configured.length} caracteres: usa al menos ${MIN_JWT_SECRET_LENGTH} ` +
          `(p. ej. node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))").`
      );
    }
    return configured;
  }

  if (generatedSecret === null) {
    generatedSecret = crypto.randomBytes(64).toString('hex');
  }

  if (env.NODE_ENV === 'production') {
    warnOnce(
      'generated-secret',
      '[Seguridad] JWT_SECRET no está definida: se generó un secreto aleatorio para este arranque. ' +
        'TODAS las sesiones se invalidarán cada vez que el servidor se reinicie y no funcionará con varias ' +
        'instancias. Define JWT_SECRET (mínimo 32 caracteres) en las variables de entorno.'
    );
  } else if (env.NODE_ENV !== 'test') {
    warnOnce(
      'generated-secret',
      '[Seguridad] JWT_SECRET no está definida: se usa un secreto aleatorio de este arranque, así que las ' +
        'sesiones se pierden al reiniciar el servidor. Defínela en backend/.env para conservarlas.'
    );
  }
  return generatedSecret;
}

/** Comprueba que una vigencia sea aceptada por jsonwebtoken y positiva. */
function isValidExpiresIn(value: SignOptions['expiresIn']): boolean {
  try {
    const probe = jwt.sign({}, 'probe-secret', { algorithm: JWT_ALGORITHM, expiresIn: value });
    const { iat, exp } = jwt.decode(probe) as { iat: number; exp: number };
    return exp - iat > 0;
  } catch {
    return false;
  }
}

/**
 * Vigencia de los tokens nuevos (JWT_EXPIRES_IN). Un valor inválido o no positivo se ignora con un
 * aviso y se usa el valor por defecto. Un texto solo de dígitos se interpreta como SEGUNDOS
 * (jsonwebtoken lo tomaría como milisegundos, lo que dejaría los tokens casi sin vida).
 */
export function getJwtExpiresIn(env: NodeJS.ProcessEnv = process.env): SignOptions['expiresIn'] {
  const raw = env.JWT_EXPIRES_IN?.trim();
  if (!raw) return DEFAULT_JWT_EXPIRES_IN;

  const value = (/^\d+$/.test(raw) ? Number(raw) : raw) as SignOptions['expiresIn'];
  if (isValidExpiresIn(value)) return value;

  warnOnce(
    `expires-in:${raw}`,
    `[Config] JWT_EXPIRES_IN="${raw}" no es una vigencia válida (usa segundos o un texto como "30m", "12h", "7d"); ` +
      `se usa ${DEFAULT_JWT_EXPIRES_IN}.`
  );
  return DEFAULT_JWT_EXPIRES_IN;
}

/**
 * Huella corta del hash de la contraseña (claim `pv`): cambia cuando se cambia la contraseña,
 * y no permite recuperar el hash.
 */
export function passwordVersion(passwordHash: string): string {
  return crypto.createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/** Datos mínimos del usuario necesarios para emitir su token. */
export interface TokenSubject {
  id: number;
  role: string;
  passwordHash: string;
}

/**
 * Emite un token de acceso firmado (HS256) para el usuario.
 * @param options.expiresIn Sustituye a JWT_EXPIRES_IN (útil en pruebas)
 */
export function signAccessToken(user: TokenSubject, options: { expiresIn?: SignOptions['expiresIn'] } = {}): string {
  return jwt.sign({ role: user.role, pv: passwordVersion(user.passwordHash) }, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    subject: String(user.id),
    expiresIn: options.expiresIn ?? getJwtExpiresIn(),
  });
}

/** Códigos de un token rechazado por la firma, el formato o la vigencia. */
export type TokenErrorCode = 'INVALID_TOKEN' | 'TOKEN_EXPIRED';

/** Error de verificación de un token (el `code` decide el campo `code` de la respuesta 401). */
export class TokenError extends Error {
  constructor(public readonly code: TokenErrorCode) {
    super(code);
    this.name = 'TokenError';
  }
}

/** Datos del token ya verificado. */
export interface AccessTokenClaims {
  userId: number;
  role: string;
  /** Huella de la contraseña con la que se emitió el token. */
  pv: string;
}

/**
 * Verifica firma (solo HS256), formato y vigencia, y devuelve los datos del token.
 * Lanza `TokenError('TOKEN_EXPIRED')` si venció y `TokenError('INVALID_TOKEN')` por cualquier otra causa.
 * NO consulta la BD: eso lo hace el middleware `authenticate` (usuario activo, rol vigente, `pv`).
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    throw new TokenError(error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
  }

  if (typeof payload === 'string') throw new TokenError('INVALID_TOKEN');

  // Un token sin vencimiento nunca caduca: solo podría existir si alguien tuviera el secreto, pero se rechaza igual.
  const userId = parseId(payload.sub);
  if (userId === null || typeof payload.pv !== 'string' || typeof payload.exp !== 'number') {
    throw new TokenError('INVALID_TOKEN');
  }

  return { userId, role: typeof payload.role === 'string' ? payload.role : '', pv: payload.pv };
}
