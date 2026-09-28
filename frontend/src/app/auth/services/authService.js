import { getApiBaseUrl } from '../../../config/api';

/**
 * Extracts descriptive error message from response.
 */
function extractErrorMessage(errorData, fallback) {
  if (!errorData) return fallback;
  const baseMsg = errorData.error || errorData.message || fallback;
  if (errorData.details) {
    const detailsMsg = typeof errorData.details === 'object'
      ? JSON.stringify(errorData.details)
      : String(errorData.details);
    return `${baseMsg}: ${detailsMsg}`;
  }
  return baseMsg;
}

/**
 * Sends login request to backend.
 * @param {{ username: string, password: string }} credentials
 * @returns {Promise<{ id: number, fullName: string, username: string, role: string, active: boolean, joinedAt: string }>}
 */
export async function loginUser(credentials) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): Credenciales inválidas.`));
  }

  const data = await response.json();
  return data.user || data;
}
