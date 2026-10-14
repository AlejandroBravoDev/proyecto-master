/**
 * ====================================================
 * UTILIDADES HTTP COMPARTIDAS (CONTROLLERS Y ROUTES)
 * ====================================================
 * - errorDetails: texto seguro para el campo `details` de un 500 (sin internals de Prisma).
 * - parseId / validateIdParam: ids de ruta enteros positivos (si no, 400 en vez de 500).
 * - parsePagination: lectura de ?page y ?limit.
 * - parseRequiredText / parseOptionalText / toFiniteNumber: validación de campos del body.
 */

import { Request, RequestParamHandler } from 'express';

/** Mayor valor que cabe en una columna INTEGER de Prisma (Int de 32 bits). */
const MAX_INT = 2147483647;

/** Texto genérico que sustituye a los errores internos de Prisma/SQLite. */
const GENERIC_DB_ERROR = 'Error interno de base de datos. Revisa los registros del servidor.';

/** Indica si el error viene de Prisma (su texto incluye consultas, tablas o rutas internas). */
function isPrismaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  if (typeof name === 'string' && name.startsWith('PrismaClient')) return true;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

/**
 * Devuelve un texto seguro para `details` en las respuestas 500.
 * - Error normal o con `message`: su mensaje.
 * - Error de Prisma (PrismaClientKnownRequestError, ValidationError...): texto genérico;
 *   el error completo se registra solo en el servidor (no en pruebas).
 * Nunca devuelve el objeto de error: el frontend lee `details` como texto.
 */
export function errorDetails(error: unknown): string {
  if (isPrismaError(error)) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[API] Error interno de base de datos:', error);
    }
    return GENERIC_DB_ERROR;
  }
  if (typeof error === 'string' && error.trim() !== '') return error;
  if (error && typeof error === 'object') {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return 'Error desconocido';
}

/**
 * Convierte un id de ruta o de query en entero positivo (acepta solo dígitos).
 * Devuelve null si no lo es: "abc", "1.5", "-3", "0", "1e3" o fuera de rango.
 */
export function parseId(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 && id <= MAX_INT ? id : null;
}

/**
 * Middleware para `router.param(<nombre>, validateIdParam)`: responde 400 si el parámetro
 * de ruta no es un entero positivo. Úsalo con cada parámetro de id (`id`, `productId`...).
 */
export const validateIdParam: RequestParamHandler = (_req, res, next, value) => {
  if (parseId(value) === null) {
    res.status(400).json({ error: 'ID inválido' });
    return;
  }
  next();
};

export interface PageParams {
  page: number;
  limit: number;
  /** Filas a saltar (para `skip` de Prisma). */
  skip: number;
}

/**
 * Lee ?page y ?limit de la query.
 * - undefined: no vino ninguno (el endpoint responde sin paginar).
 * - null: alguno es inválido (el controller responde 400).
 * - PageParams: `page` por defecto 1, `limit` por defecto `defaultLimit`; un `limit` mayor que
 *   `maxLimit` se recorta a `maxLimit`.
 */
export function parsePagination(
  query: Request['query'],
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PageParams | null | undefined {
  const { defaultLimit = 15, maxLimit = 100 } = options;
  const rawPage = query.page;
  const rawLimit = query.limit;
  if (rawPage === undefined && rawLimit === undefined) return undefined;

  const page = rawPage === undefined ? 1 : parseId(rawPage);
  const requestedLimit = rawLimit === undefined ? defaultLimit : parseId(rawLimit);
  if (page === null || requestedLimit === null) return null;

  const limit = Math.min(requestedLimit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

/** Texto obligatorio: devuelve el valor recortado, o null si no es texto o queda vacío. */
export function parseRequiredText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export type OptionalText = { valid: true; value: string | null | undefined } | { valid: false };

/**
 * Texto opcional que se puede limpiar:
 * - undefined: no se envió (no se toca el campo).
 * - null o '' (solo espacios): se guarda null.
 * - texto: recortado.
 * Cualquier otro tipo es inválido.
 */
export function parseOptionalText(value: unknown): OptionalText {
  if (value === undefined) return { valid: true, value: undefined };
  if (value === null) return { valid: true, value: null };
  if (typeof value !== 'string') return { valid: false };
  const trimmed = value.trim();
  return { valid: true, value: trimmed === '' ? null : trimmed };
}

/**
 * Número finito a partir de un número o de un texto numérico ("7.5").
 * Devuelve null para todo lo demás (vacío, booleanos, null, NaN, Infinity, arreglos...).
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Número opcional con mínimo (por defecto 0):
 * - undefined: no se envió (undefined, null o '').
 * - number: finito y mayor o igual a `min`.
 * - null: se envió pero no es válido.
 */
export function parseOptionalNumber(value: unknown, min = 0): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = toFiniteNumber(value);
  return parsed !== null && parsed >= min ? parsed : null;
}
