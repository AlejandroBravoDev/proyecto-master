/// <reference path="../types/express.d.ts" />
/**
 * ====================================================
 * AUTENTICACIÓN Y AUTORIZACIÓN (MIDDLEWARE)
 * ====================================================
 * - authenticate: exige `Authorization: Bearer <token>`, verifica firma y vigencia y VUELVE A LEER
 *   el usuario de la BD en cada petición (el rol y el estado del token no se creen): rechaza si el
 *   usuario ya no existe, está inactivo o cambió su contraseña desde que se emitió el token.
 *   Adjunta `req.user = { id, username, fullName, role }`.
 * - requireRole: 403 si el rol del usuario autenticado no está permitido.
 * - requireAdminOrFields: el ADMIN pasa siempre; el resto solo si el cuerpo trae únicamente los
 *   campos permitidos (p. ej. el trabajador puede marcar un producto agotado o ajustar stock, pero
 *   no editar el resto del recurso).
 *
 * Respuestas: 401 `{ error, code }` con code NO_TOKEN | INVALID_TOKEN | TOKEN_EXPIRED | USER_INACTIVE
 * y 403 `{ error }`. Nunca se devuelven detalles internos (por qué falló la firma, etc.).
 */

import crypto from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import prisma from '../prisma/client';
import { errorDetails } from '../utils/http.utils';
import { TokenError, passwordVersion, verifyAccessToken } from '../utils/jwt.utils';

export type Role = 'ADMIN' | 'WORKER';

/** Códigos del campo `code` de las respuestas 401. */
export type AuthErrorCode = 'NO_TOKEN' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'USER_INACTIVE';

export const UNAUTHORIZED_MESSAGE = 'Sesión no válida o expirada. Inicia sesión de nuevo.';
export const FORBIDDEN_MESSAGE = 'No tienes permisos para realizar esta acción.';

/** Responde 401 con el mensaje genérico y el motivo en `code`. */
export function sendUnauthorized(res: Response, code: AuthErrorCode): void {
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ error: UNAUTHORIZED_MESSAGE, code });
}

/** Responde 403: el usuario está autenticado pero su rol no permite la acción. */
export function sendForbidden(res: Response): void {
  res.status(403).json({ error: FORBIDDEN_MESSAGE });
}

/** Extrae el token de `Authorization: Bearer <token>` (esquema sin distinguir mayúsculas). */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

/** Comparación en tiempo constante de dos textos (devuelve false si su longitud difiere). */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

/** Exige un token válido de un usuario activo y adjunta `req.user`. */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, 'NO_TOKEN');
    return;
  }

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch (error) {
    sendUnauthorized(res, error instanceof TokenError ? error.code : 'INVALID_TOKEN');
    return;
  }

  try {
    // Siempre desde la BD: un cambio de rol, una baja o un cambio de contraseña surten efecto al instante.
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, username: true, fullName: true, role: true, active: true, passwordHash: true },
    });

    if (!user) {
      sendUnauthorized(res, 'INVALID_TOKEN');
      return;
    }
    if (!user.active) {
      sendUnauthorized(res, 'USER_INACTIVE');
      return;
    }
    if (!safeEqual(passwordVersion(user.passwordHash), claims.pv)) {
      sendUnauthorized(res, 'INVALID_TOKEN');
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'WORKER',
    };
    next();
  } catch (error) {
    console.error('[Auth] Error al verificar la sesión:', errorDetails(error));
    res.status(500).json({ error: 'Error interno al verificar la sesión.' });
  }
}

/** Permite el paso solo a los roles indicados (403 al resto). Debe ir DESPUÉS de `authenticate`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      // Defensa: la ruta se montó sin `authenticate`
      sendUnauthorized(res, 'NO_TOKEN');
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendForbidden(res);
      return;
    }
    next();
  };
}

/**
 * El ADMIN pasa siempre; cualquier otro rol solo si el cuerpo trae EXCLUSIVAMENTE los campos
 * indicados (403 si trae alguno más). Debe ir DESPUÉS de `authenticate`.
 */
export function requireAdminOrFields(...allowedFields: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      sendUnauthorized(res, 'NO_TOKEN');
      return;
    }
    if (req.user.role === 'ADMIN') {
      next();
      return;
    }

    const body: unknown = req.body;
    const isPlainObject = typeof body === 'object' && body !== null && !Array.isArray(body);
    const onlyAllowed = isPlainObject && Object.keys(body as object).every((key) => allowedFields.includes(key));
    if (!onlyAllowed) {
      sendForbidden(res);
      return;
    }
    next();
  };
}
