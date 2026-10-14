/**
 * ====================================================
 * CONTROLADOR DE AUTENTICACIÓN (CONTROLLER LAYER)
 * ====================================================
 * Procesa peticiones HTTP de login y validación de sesiones.
 */

import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendUnauthorized } from '../middleware/auth.middleware';
import { errorDetails } from '../utils/http.utils';

export class AuthController {
  /**
   * POST /api/auth/login
   * Valida credenciales e inicia sesión para trabajadores y administradores.
   * Responde `{ user, token }`: el token se envía después en `Authorization: Bearer <token>`.
   */
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body ?? {};

      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
      }

      const result = await authService.login({ username, password });
      // La respuesta lleva un token: que ningún proxy ni navegador la guarde en caché
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'MISSING_CREDENTIALS') {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
      }
      if (error.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      }
      if (error.message === 'USER_INACTIVE') {
        return res.status(403).json({ error: 'Esta cuenta de trabajador está inactiva. Contacte al administrador.' });
      }
      return res.status(500).json({ error: 'Error interno en autenticación', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/auth/me (requiere token)
   * Devuelve `{ user }` leído de la BD en este momento: sirve para validar un token guardado y
   * refrescar el rol y el estado del usuario al recargar la aplicación.
   */
  async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'NO_TOKEN');
      }

      const profile = await authService.getProfile(req.user.id);
      if (!profile) {
        return sendUnauthorized(res, 'INVALID_TOKEN');
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(profile);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al consultar la sesión', details: errorDetails(error) });
    }
  }
}

export const authController = new AuthController();
