import { requestJson } from '../../../config/apiFetch';
import { AUTH_ENDPOINTS } from './endpoints';

/**
 * User as the backend returns it (the shape does not change with the JWT).
 * @typedef {{ id: number, fullName: string, username: string, role: string, active: boolean, joinedAt: string }} AuthUser
 */

/**
 * Sends login request to backend. It does not persist anything: `AuthContext` stores the session.
 * The request is public (`skipAuth`): it carries no token and a 401 means "wrong credentials",
 * not "session expired".
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ user: AuthUser, token: string }>}
 */
export async function loginUser(credentials) {
  const data = await requestJson(
    AUTH_ENDPOINTS.LOGIN,
    { method: 'POST', body: credentials, skipAuth: true },
    'Credenciales inválidas.'
  );
  if (!data?.user || typeof data.token !== 'string' || !data.token) {
    throw new Error('El servidor no devolvió una sesión válida. Intenta iniciar sesión de nuevo.');
  }
  return { user: data.user, token: data.token };
}

/**
 * Fetches the current user fresh from the database (validates the stored token and refreshes role/status).
 * A 401 makes `apiFetch` close the session; the caller only has to deal with the other errors.
 * @returns {Promise<AuthUser>}
 */
export async function fetchCurrentUser() {
  const data = await requestJson(AUTH_ENDPOINTS.ME, {}, 'No se pudo verificar la sesión.');
  if (!data?.user) {
    throw new Error('El servidor no devolvió los datos del usuario.');
  }
  return data.user;
}
