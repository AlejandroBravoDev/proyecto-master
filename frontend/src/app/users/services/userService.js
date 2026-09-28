import { USER_ENDPOINTS } from './endpoints';

/**
 * Extracts clear error message from backend error responses.
 */
function extractErrorMessage(errorData, fallbackMessage) {
  if (!errorData) return fallbackMessage;
  const baseMsg = errorData.error || errorData.message || fallbackMessage;
  if (errorData.details) {
    const detailsMsg = typeof errorData.details === 'object'
      ? JSON.stringify(errorData.details)
      : String(errorData.details);
    return `${baseMsg}: ${detailsMsg}`;
  }
  return baseMsg;
}

/**
 * Fetches all users / workers with pagination.
 * @param {number} [page=1]
 * @param {number} [limit=15]
 * @returns {Promise<{ total: number, page: number, totalPages: number, users: Array }>}
 */
export async function fetchUsers(page = 1, limit = 15) {
  const response = await fetch(`${USER_ENDPOINTS.USERS()}?page=${page}&limit=${limit}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudieron cargar los usuarios.`));
  }

  const data = await response.json();
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
export async function createUser(data) {
  const response = await fetch(USER_ENDPOINTS.USERS(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo crear el usuario.`));
  }

  return response.json();
}

/**
 * Updates an existing user's information.
 * @param {number|string} id
 * @param {{ fullName?: string, username?: string, role?: string, joinedAt?: string, active?: boolean }} data
 * @returns {Promise<Object>}
 */
export async function updateUser(id, data) {
  const response = await fetch(USER_ENDPOINTS.USER_DETAIL(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo actualizar el usuario.`));
  }

  return response.json();
}

/**
 * Updates a user's password with strict 6 alphanumeric validation.
 * @param {number|string} id
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function updateUserPassword(id, password) {
  const response = await fetch(USER_ENDPOINTS.USER_PASSWORD(id), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo actualizar la contraseña.`));
  }

  return response.json();
}

/**
 * Modifies the active/inactive status of a user.
 * @param {number|string} id
 * @param {boolean} active
 * @returns {Promise<Object>}
 */
export async function updateUserStatus(id, active) {
  const response = await fetch(USER_ENDPOINTS.USER_STATUS(id), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo cambiar el estado del usuario.`));
  }

  return response.json();
}
