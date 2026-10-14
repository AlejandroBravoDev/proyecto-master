import { getApiBaseUrl } from '../../../config/api';
import { requestJson } from '../../../config/apiFetch';

/**
 * Sends login request to backend.
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ id: number, fullName: string, username: string, role: string, active: boolean, joinedAt: string }>}
 */
export async function loginUser(credentials) {
  const data = await requestJson(
    `${getApiBaseUrl()}/api/auth/login`,
    { method: 'POST', body: credentials },
    'Credenciales inválidas.'
  );
  return data.user || data;
}
