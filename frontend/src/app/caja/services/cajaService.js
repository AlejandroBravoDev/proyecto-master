/**
 * Caja & Arqueos Service Layer
 * Handles all HTTP requests for cash register session lifecycle:
 * Opening (Apertura con base inicial), Status in real-time, Closing (Arqueo físico),
 * and Shift History & Audit.
 */

import { requestJson } from '../../../config/apiFetch';
import { CAJA_ENDPOINTS } from './endpoints';

/**
 * Fetches the real-time status of the cash register (OPEN / CLOSED, active session, live metrics).
 * @returns {Promise<{ isOpen: boolean, activeSession: Object|null, lastClosedSession: Object|null }>}
 */
export function fetchCajaStatus() {
  return requestJson(CAJA_ENDPOINTS.STATUS, {}, 'No se pudo consultar el estado de la caja.');
}

/**
 * Opens a new cash register shift session with initial base float denominations.
 * @param {{ denominations: Object|Array, notes?: string, userId?: number }} data
 * @returns {Promise<Object>}
 */
export function openCajaSession(data) {
  return requestJson(CAJA_ENDPOINTS.OPEN, { method: 'POST', body: data }, 'No se pudo abrir la caja.');
}

/**
 * Closes the active cash register session and calculates balancing difference (Arqueo).
 * @param {{ denominations: Object|Array, closingNotes?: string, userId?: number }} data
 * @returns {Promise<Object>}
 */
export function closeCajaSession(data) {
  return requestJson(CAJA_ENDPOINTS.CLOSE, { method: 'POST', body: data }, 'No se pudo cerrar la caja.');
}

/**
 * Updates an existing cash register session (Admin only).
 * @param {number|string} id
 * @param {{ initialAmount?: number, finalAmount?: number, notes?: string, closingNotes?: string }} data
 * @returns {Promise<Object>}
 */
export function updateCajaSession(id, data) {
  return requestJson(CAJA_ENDPOINTS.UPDATE_SESSION(id), { method: 'PUT', body: data }, 'No se pudo actualizar la sesión de caja.');
}

/**
 * Fetches shift sessions history with audit data.
 * @param {number} [limit=50]
 * @param {number} [page=1]
 * @param {number|string} [openedByUserId]
 * @returns {Promise<{ total: number, page: number, totalPages: number, sessions: Array }>}
 */
export function fetchCajaHistory(limit = 50, page = 1, openedByUserId) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
  });
  if (openedByUserId) {
    params.set('openedByUserId', String(openedByUserId));
  }

  return requestJson(`${CAJA_ENDPOINTS.HISTORY}?${params.toString()}`, {}, 'No se pudo cargar el historial de arqueos.');
}

/**
 * Fetches detailed audit information of a single cash session by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function fetchCajaSessionDetail(id) {
  return requestJson(CAJA_ENDPOINTS.SESSION_DETAIL(id), {}, 'No se pudo obtener el detalle de la sesión.');
}

/**
 * Fetches all registered users/employees for Admin filtering.
 * @returns {Promise<Array>}
 */
export async function fetchUsersForCaja() {
  const data = await requestJson(CAJA_ENDPOINTS.USERS, {}, 'No se pudo cargar la lista de empleados.');
  return Array.isArray(data) ? data : data.users || [];
}
