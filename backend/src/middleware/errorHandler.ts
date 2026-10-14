/**
 * ====================================================
 * 404 Y MANEJO GLOBAL DE ERRORES
 * ====================================================
 * Montar al FINAL de la cadena. Traduce los errores de los body parsers (JSON roto,
 * cuerpo demasiado grande...) a respuestas 4xx claras en lugar de un 500, y nunca devuelve
 * objetos de error en `details`: solo texto.
 */

import type { Request, Response, NextFunction } from 'express';

/** Ruta o endpoint inexistente. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Ruta o endpoint no encontrado' });
}

/** Texto seguro de un error desconocido (nunca el objeto: puede traer internals de Prisma/SQLite). */
export function errorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Error desconocido';
}

/** Errores conocidos de body-parser/raw-body -> [estado HTTP, mensaje en español]. */
const BODY_PARSER_ERRORS: Record<string, [number, string]> = {
  'entity.parse.failed': [400, 'JSON inválido'],
  'entity.too.large': [413, 'El cuerpo de la petición supera el tamaño máximo permitido'],
  'parameters.too.many': [413, 'La petición trae demasiados parámetros'],
  'request.size.invalid': [400, 'El tamaño del cuerpo de la petición no es válido'],
  'request.aborted': [400, 'La petición fue cancelada antes de terminar'],
  'encoding.unsupported': [415, 'La codificación del cuerpo no está soportada'],
  'charset.unsupported': [415, 'El conjunto de caracteres del cuerpo no está soportado'],
};

/** Middleware de captura global de errores. */
export function errorHandler(err: any, _req: Request, res: Response, next: NextFunction): void {
  // Si ya se empezó a responder, Express debe cerrar la conexión (no se puede cambiar el estado).
  if (res.headersSent) {
    next(err);
    return;
  }

  const known = typeof err?.type === 'string' ? BODY_PARSER_ERRORS[err.type] : undefined;
  if (known) {
    res.status(known[0]).json({ error: known[1] });
    return;
  }

  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: errorText(err) });
}
