/**
 * ====================================================
 * SERVICIO DE AUTENTICACIÓN (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el inicio de sesión local para trabajadores y administradores.
 */

import { verifyPassword } from '../utils/auth.utils';
import { findUserByUsername } from '../utils/username.utils';

export class AuthService {
  /**
   * Valida credenciales e inicia sesión.
   * El nombre de usuario no distingue mayúsculas: "admin", "ADMIN" y "Admin" son el mismo usuario.
   * @param credentials Objeto con username y password
   */
  async login(credentials: { username: string; password: string }) {
    const { username, password } = credentials;

    if (!username || !password) {
      throw new Error('MISSING_CREDENTIALS');
    }

    // Búsqueda del usuario por nombre de usuario, sin distinguir mayúsculas
    const user = await findUserByUsername(username);

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
