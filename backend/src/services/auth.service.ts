/**
 * ====================================================
 * SERVICIO DE AUTENTICACIÓN (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el inicio de sesión local para trabajadores y administradores y emite el token JWT
 * (ver utils/jwt.utils.ts). El token solo lo emite el login: no hay renovación ni logout de servidor.
 */

import prisma from '../prisma/client';
import { verifyPassword } from '../utils/auth.utils';
import { signAccessToken } from '../utils/jwt.utils';
import { findUserByUsername } from '../utils/username.utils';

/** Datos del usuario que se devuelven al cliente (nunca el passwordHash). */
function toPublicUser(user: {
  id: number;
  fullName: string;
  username: string;
  role: string;
  active: boolean;
  joinedAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    active: user.active,
    joinedAt: user.joinedAt
  };
}

export class AuthService {
  /**
   * Valida credenciales e inicia sesión. Devuelve `{ user, token }`.
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
      user: toPublicUser(user),
      token: signAccessToken(user)
    };
  }

  /**
   * Datos actuales del usuario autenticado, leídos de la BD (rol y estado vigentes).
   * Devuelve `{ user }` con la misma forma que el login, o `null` si ya no existe o está inactivo.
   * @param id ID del usuario (el de `req.user`)
   */
  async getProfile(id: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.active) return null;
    return { user: toPublicUser(user) };
  }
}

export const authService = new AuthService();
