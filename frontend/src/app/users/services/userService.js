import { requestJson } from '../../../config/apiFetch';
import { USER_ENDPOINTS } from './endpoints';

/**
 * Fetches all users / workers with pagination.
 * @param {number} [page=1]
 * @param {number} [limit=15]
 * @returns {Promise<{ total: number, page: number, totalPages: number, users: Array }>}
 */
export async function fetchUsers(page = 1, limit = 15) {
  const data = await requestJson(
    `${USER_ENDPOINTS.USERS()}?page=${page}&limit=${limit}`,
    {},
    'No se pudieron cargar los usuarios.'
  );

  if (Array.isArray(data)) {
    return {
      total: data.length,
      page: 1,
      limit: data.length,
      totalPages: 1,
      users: data,
    };
  }
  return data;
}

/**
 * Creates a new worker or admin user.
 * @param {{ fullName: string, username: string, password: string, role?: string, joinedAt?: string }} data
 * @returns {Promise<Object>}
 */
export function createUser(data) {
  return requestJson(USER_ENDPOINTS.USERS(), { method: 'POST', body: data }, 'No se pudo crear el usuario.');
}

/**
 * Updates an existing user's information.
 * @param {number|string} id
 * @param {{ fullName?: string, username?: string, role?: string, joinedAt?: string, active?: boolean }} data
 * @returns {Promise<Object>}
 */
export function updateUser(id, data) {
  return requestJson(USER_ENDPOINTS.USER_DETAIL(id), { method: 'PUT', body: data }, 'No se pudo actualizar el usuario.');
}

/**
 * Updates a user's password with strict 6 alphanumeric validation.
 * @param {number|string} id
 * @param {string} password
 * @returns {Promise<Object>}
 */
export function updateUserPassword(id, password) {
  return requestJson(
    USER_ENDPOINTS.USER_PASSWORD(id),
    { method: 'PATCH', body: { password } },
    'No se pudo actualizar la contraseña.'
  );
}

/**
 * Modifies the active/inactive status of a user.
 * @param {number|string} id
 * @param {boolean} active
 * @returns {Promise<Object>}
 */
export function updateUserStatus(id, active) {
  return requestJson(
    USER_ENDPOINTS.USER_STATUS(id),
    { method: 'PATCH', body: { active } },
    'No se pudo cambiar el estado del usuario.'
  );
}
