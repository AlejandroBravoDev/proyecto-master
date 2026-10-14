/**
 * ====================================================
 * CONTROLADOR DE USUARIOS Y TRABAJADORES (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP para el CRUD de personal y control de acceso.
 */

import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { errorDetails, parsePagination } from '../utils/http.utils';

export class UserController {
  /**
   * GET /api/users
   * Lista los usuarios/trabajadores registrados.
   * Sin ?page ni ?limit devuelve el arreglo completo; con alguno de ellos devuelve
   * `{ total, page, limit, totalPages, users }` paginado en el servidor.
   */
  async getUsers(req: Request, res: Response) {
    try {
      const pagination = parsePagination(req.query, { defaultLimit: 15, maxLimit: 100 });
      if (pagination === null) {
        return res.status(400).json({ error: 'page y limit deben ser enteros mayores a 0.' });
      }

      if (pagination) {
        return res.status(200).json(await userService.getUsersPage(pagination));
      }

      const users = await userService.getAllUsers();
      return res.status(200).json(users);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener usuarios', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/users/:id
   * Obtiene el detalle de un usuario por ID.
   */
  async getUserById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const user = await userService.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      return res.status(200).json(user);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener usuario', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/users
   * Crea un nuevo trabajador o administrador.
   */
  async createUser(req: Request, res: Response) {
    try {
      const { fullName, username, password, role, joinedAt } = req.body ?? {};

      if (
        !fullName || typeof fullName !== 'string' ||
        !username || typeof username !== 'string' ||
        !password || typeof password !== 'string'
      ) {
        return res.status(400).json({ error: 'Nombre completo, nombre de usuario y contraseña son obligatorios.' });
      }

      const user = await userService.createUser({ fullName, username, password, role, joinedAt });
      return res.status(201).json(user);
    } catch (error: any) {
      if (error.message === 'INVALID_PASSWORD') {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      if (error.message === 'USERNAME_ALREADY_EXISTS') {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
      }
      if (error.message === 'MISSING_FULL_NAME' || error.message === 'MISSING_USERNAME') {
        return res.status(400).json({ error: 'Datos de usuario incompletos.' });
      }
      if (error.message === 'INVALID_JOINED_AT') {
        return res.status(400).json({ error: 'La fecha de ingreso no es válida.' });
      }
      return res.status(500).json({ error: 'Error al crear usuario', details: errorDetails(error) });
    }
  }

  /**
   * PUT /api/users/:id
   * Actualiza los datos generales de un usuario.
   */
  async updateUser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { fullName, username, role, active, joinedAt } = req.body ?? {};

      if (
        (fullName !== undefined && typeof fullName !== 'string') ||
        (username !== undefined && typeof username !== 'string')
      ) {
        return res.status(400).json({ error: 'Datos de usuario incompletos.' });
      }
      if (active !== undefined && typeof active !== 'boolean') {
        return res.status(400).json({ error: 'El campo "active" debe ser booleano.' });
      }

      const user = await userService.updateUser(id, { fullName, username, role, active, joinedAt });
      return res.status(200).json(user);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      if (error.message === 'USERNAME_ALREADY_EXISTS') {
        return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
      }
      if (error.message === 'MISSING_FULL_NAME' || error.message === 'MISSING_USERNAME') {
        return res.status(400).json({ error: 'El nombre completo y el nombre de usuario no pueden estar vacíos.' });
      }
      if (error.message === 'INVALID_JOINED_AT') {
        return res.status(400).json({ error: 'La fecha de ingreso no es válida.' });
      }
      if (error.message === 'CANNOT_DEACTIVATE_LAST_ADMIN') {
        return res.status(400).json({ error: 'No se puede desactivar o degradar al único administrador activo del sistema.' });
      }
      return res.status(500).json({ error: 'Error al actualizar usuario', details: errorDetails(error) });
    }
  }

  /**
   * PATCH /api/users/:id/password
   * Actualiza la contraseña de un usuario con validación estricta de 6 caracteres.
   */
  async updatePassword(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { password } = req.body ?? {};

      if (!password) {
        return res.status(400).json({ error: 'La nueva contraseña es obligatoria.' });
      }

      const result = await userService.updatePassword(id, password);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      if (error.message === 'INVALID_PASSWORD') {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }
      return res.status(500).json({ error: 'Error al actualizar contraseña', details: errorDetails(error) });
    }
  }

  /**
   * PATCH /api/users/:id/status
   * Modifica el estado activo o inactivo de un usuario.
   */
  async updateStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { active } = req.body ?? {};

      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'El campo "active" booleano es obligatorio.' });
      }

      const user = await userService.updateStatus(id, active);
      return res.status(200).json(user);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      if (error.message === 'CANNOT_DEACTIVATE_LAST_ADMIN') {
        return res.status(400).json({ error: 'No se puede desactivar al único administrador activo del sistema.' });
      }
      return res.status(500).json({ error: 'Error al cambiar estado del usuario', details: errorDetails(error) });
    }
  }
}

export const userController = new UserController();
