/**
 * ====================================================
 * SERVICIO DE GESTIÓN DE USUARIOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona la administración de trabajadores y administradores del POS.
 */

import prisma from '../prisma/client';
import { isValidPassword, hashPassword } from '../utils/auth.utils';

export class UserService {
  /**
   * Obtiene todos los usuarios ordenados por ID ascendente (sin passwordHash).
   */
  async getAllUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        active: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { id: 'asc' }
    });
  }

  /**
   * Obtiene el detalle de un usuario por su ID.
   */
  async getUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        active: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      }
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

    // Verificar si el username ya está en uso
    const existing = await prisma.user.findFirst({
      where: { username: { equals: trimmedUsername } }
    });

    if (existing) {
      throw new Error('USERNAME_ALREADY_EXISTS');
    }

    const role = data.role === 'ADMIN' ? 'ADMIN' : 'WORKER';
    const passwordHash = hashPassword(data.password);
    const joinedAt = data.joinedAt ? new Date(data.joinedAt) : new Date();

    return prisma.user.create({
      data: {
        fullName: data.fullName.trim(),
        username: trimmedUsername,
        passwordHash,
        role,
        active: true,
        joinedAt
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        active: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      }
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

    // Si se modifica el username, verificar que no esté ocupado por otro usuario
    if (data.username && data.username.trim() !== user.username) {
      const trimmedUser = data.username.trim();
      const existing = await prisma.user.findFirst({
        where: {
          username: { equals: trimmedUser },
          NOT: { id }
        }
      });
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
        joinedAt: data.joinedAt !== undefined ? new Date(data.joinedAt) : undefined
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        active: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      }
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
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        active: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
}

export const userService = new UserService();
