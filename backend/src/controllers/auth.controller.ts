/**
 * ====================================================
 * CONTROLADOR DE AUTENTICACIÓN (CONTROLLER LAYER)
 * ====================================================
 * Procesa peticiones HTTP de login y validación de sesiones.
 */

import { Request, Response } from 'express';
import { authService } from '../services/auth.service';

export class AuthController {
  /**
   * POST /api/auth/login
   * Valida credenciales e inicia sesión para trabajadores y administradores.
   */
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
      }

      const result = await authService.login({ username, password });
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
      return res.status(500).json({ error: 'Error interno en autenticación', details: error.message || error });
    }
  }
}

export const authController = new AuthController();
