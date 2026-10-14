/**
 * ====================================================
 * SERVICIO DE GESTIÓN DE USUARIOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona la administración de trabajadores y administradores del POS.
 * El nombre de usuario es único SIN distinguir mayúsculas ("maria" == "Maria"),
 * pero se guarda con la capitalización que escribió la persona.
 */

import prisma from '../prisma/client';
import { isValidPassword, hashPassword } from '../utils/auth.utils';
import { findUserByUsername } from '../utils/username.utils';

/** Campos públicos de un usuario (nunca el passwordHash). */
const USER_SELECT = {
  id: true,
  fullName: true,
  username: true,
  role: true,
  active: true,
  joinedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

/** Convierte la fecha de ingreso recibida; lanza INVALID_JOINED_AT si no es una fecha válida. */
function parseJoinedAt(value: Date | string): Date {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('INVALID_JOINED_AT');
  }
  return date;
}

export class UserService {
  /**
   * Obtiene todos los usuarios ordenados por ID ascendente (sin passwordHash).
   */
  async getAllUsers() {
    return prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { id: 'asc' }
    });
  }

  /**
   * Obtiene una página de usuarios (orden por ID ascendente, sin passwordHash).
   * Devuelve `{ total, page, limit, totalPages, users }`.
   * @param pagination Página (desde 1) y usuarios por página
   */
  async getUsersPage(pagination: { page: number; limit: number }) {
    const [total, users] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: USER_SELECT,
        orderBy: { id: 'asc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      })
    ]);

    return {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
      users
    };
  }

  /**
   * Obtiene el detalle de un usuario por su ID.
   */
  async getUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: USER_SELECT
    });
  }

  /**
   * Registra un nuevo trabajador/administrador.
   */
  async createUser(data: {
    fullName: string;
    username: string;
    password: string;
    role?: string;
    joinedAt?: Date | string;
  }) {
    if (!data.fullName || !data.fullName.trim()) {
      throw new Error('MISSING_FULL_NAME');
    }

    if (!data.username || !data.username.trim()) {
      throw new Error('MISSING_USERNAME');
    }

    const trimmedUsername = data.username.trim();

    // Validar regla de contraseña de mínimo 6 caracteres
    if (!isValidPassword(data.password)) {
      throw new Error('INVALID_PASSWORD');
    }

    // Verificar si el username ya está en uso (sin distinguir mayúsculas)
    const existing = await findUserByUsername(trimmedUsername);

    if (existing) {
      throw new Error('USERNAME_ALREADY_EXISTS');
    }

    const role = data.role === 'ADMIN' ? 'ADMIN' : 'WORKER';
    const passwordHash = hashPassword(data.password);
    const joinedAt = data.joinedAt ? parseJoinedAt(data.joinedAt) : new Date();

    return prisma.user.create({
      data: {
        fullName: data.fullName.trim(),
        username: trimmedUsername,
        passwordHash,
        role,
        active: true,
        joinedAt
      },
      select: USER_SELECT
    });
  }

  /**
   * Actualiza los datos generales de un usuario.
   */
  async updateUser(
    id: number,
    data: {
      fullName?: string;
      username?: string;
      role?: string;
      active?: boolean;
      joinedAt?: Date | string;
    }
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Un nombre o usuario enviado no puede quedar vacío
    if (data.fullName !== undefined && !data.fullName.trim()) {
      throw new Error('MISSING_FULL_NAME');
    }
    if (data.username !== undefined && !data.username.trim()) {
      throw new Error('MISSING_USERNAME');
    }

    // Si se modifica el username, verificar que no esté ocupado por otro usuario
    // (sin distinguir mayúsculas; cambiar solo la capitalización del propio usuario sí es válido)
    if (data.username !== undefined && data.username.trim() !== user.username) {
      const existing = await findUserByUsername(data.username.trim(), id);
      if (existing) {
        throw new Error('USERNAME_ALREADY_EXISTS');
      }
    }

    // Validar protección del último ADMIN activo
    const nextRole = data.role !== undefined ? (data.role === 'ADMIN' ? 'ADMIN' : 'WORKER') : user.role;
    const nextActive = data.active !== undefined ? Boolean(data.active) : user.active;

    if (user.role === 'ADMIN' && (nextRole !== 'ADMIN' || !nextActive)) {
      const activeAdminsCount = await prisma.user.count({
        where: { role: 'ADMIN', active: true, NOT: { id } }
      });
      if (activeAdminsCount === 0) {
        throw new Error('CANNOT_DEACTIVATE_LAST_ADMIN');
      }
    }

    return prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName !== undefined ? data.fullName.trim() : undefined,
        username: data.username !== undefined ? data.username.trim() : undefined,
        role: nextRole,
        active: nextActive,
        joinedAt: data.joinedAt !== undefined ? parseJoinedAt(data.joinedAt) : undefined
      },
      select: USER_SELECT
    });
  }

  /**
   * Actualiza la contraseña de un usuario validando la regla de mínimo 6 caracteres.
   */
  async updatePassword(id: number, password: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    if (!isValidPassword(password)) {
      throw new Error('INVALID_PASSWORD');
    }

    const passwordHash = hashPassword(password);

    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  /**
   * Modifica el estado activo/inactivo de un trabajador.
   */
  async updateStatus(id: number, active: boolean) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Si se va a desactivar a un administrador, asegurar que no sea el único activo
    if (user.role === 'ADMIN' && !active) {
      const activeAdminsCount = await prisma.user.count({
        where: { role: 'ADMIN', active: true, NOT: { id } }
      });
      if (activeAdminsCount === 0) {
        throw new Error('CANNOT_DEACTIVATE_LAST_ADMIN');
      }
    }

    return prisma.user.update({
      where: { id },
      data: { active: Boolean(active) },
      select: USER_SELECT
    });
  }
}

export const userService = new UserService();
