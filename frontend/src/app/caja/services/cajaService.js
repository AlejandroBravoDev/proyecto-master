/**
 * Caja & Arqueos Service Layer
 * Handles all HTTP requests for cash register session lifecycle:
 * Opening (Apertura con base inicial), Status in real-time, Closing (Arqueo físico),
 * and Shift History & Audit.
 */

import { CAJA_ENDPOINTS } from './endpoints';

/**
 * Fetches the real-time status of the cash register (OPEN / CLOSED, active session, live metrics).
 * @returns {Promise<{ isOpen: boolean, activeSession: Object|null, lastClosedSession: Object|null }>}
 */
export async function fetchCajaStatus() {
  const response = await fetch(CAJA_ENDPOINTS.STATUS, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo consultar el estado de la caja.`);
  }

  return response.json();
}

/**
 * Opens a new cash register shift session with initial base float denominations.
 * @param {{ denominations: Object|Array, notes?: string }} data
 * @returns {Promise<Object>}
 */
export async function openCajaSession(data) {
  const response = await fetch(CAJA_ENDPOINTS.OPEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo abrir la caja.`);
  }

  return response.json();
}

/**
 * Closes the active cash register session and calculates balancing difference (Arqueo).
 * @param {{ denominations: Object|Array, closingNotes?: string }} data
 * @returns {Promise<Object>}
 */
export async function closeCajaSession(data) {
  const response = await fetch(CAJA_ENDPOINTS.CLOSE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo cerrar la caja.`);
  }

  return response.json();
}

/**
 * Fetches shift sessions history with audit data.
 * @param {number} [limit=50]
 * @param {number} [page=1]
 * @returns {Promise<{ total: number, page: number, totalPages: number, sessions: Array }>}
 */
export async function fetchCajaHistory(limit = 50, page = 1) {
  const response = await fetch(`${CAJA_ENDPOINTS.HISTORY}?limit=${limit}&page=${page}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo cargar el historial de arqueos.`);
  }

  return response.json();
}

/**
 * Fetches detailed audit information of a single cash session by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchCajaSessionDetail(id) {
  const response = await fetch(CAJA_ENDPOINTS.SESSION_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener el detalle de la sesión.`);
  }

  return response.json();
}
