/**
 * ====================================================
 * SERVICIO DE AUTENTICACIÓN (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el inicio de sesión local para trabajadores y administradores.
 */

import prisma from '../prisma/client';
import { verifyPassword } from '../utils/auth.utils';

export class AuthService {
  /**
   * Valida credenciales e inicia sesión.
   * @param credentials Objeto con username y password
   */
  async login(credentials: { username: string; password: string }) {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('MISSING_CREDENTIALS');
    }

    const trimmedUser = username.trim();

    // Búsqueda del usuario por nombre de usuario (en SQLite Prisma findFirst con filtro insensible a mayúsculas o exacto)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: trimmedUser
        }
      }
    });

    if (!user) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!user.active) {
      throw new Error('USER_INACTIVE');
    }

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        active: user.active,
        joinedAt: user.joinedAt
      }
    };
  }
}

export const authService = new AuthService();
