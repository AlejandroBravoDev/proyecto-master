/**
 * ====================================================
 * CUERPO DE LA PETICIÓN
 * ====================================================
 * - Límite explícito para JSON y formularios (el import masivo de Excel va por multer, aparte).
 * - En Express 5, un POST/PUT sin cuerpo deja `req.body` en `undefined` y cualquier controller
 *   que haga `const { x } = req.body` fallaba con 500. `ensureBody` lo normaliza a `{}`
 *   para que la validación del controller responda 400.
 */

import type { Request, Response, NextFunction } from 'express';

/** Tamaño máximo del cuerpo JSON / urlencoded. Las comandas y catálogos caben de sobra. */
export const BODY_LIMIT = '100kb';

/** Garantiza que `req.body` sea siempre un objeto (nunca undefined/null). Montar DESPUÉS de los body parsers. */
export function ensureBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  next();
}
