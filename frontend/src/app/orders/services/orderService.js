/**
 * Orders Service Layer
 * Handles all HTTP requests for order creation, listing, detail viewing, cancellation,
 * and menu lookups for the POS order taking interface.
 */

import { requestJson } from '../../../config/apiFetch';
import { ORDER_ENDPOINTS } from './endpoints';

/**
 * Fetches the list of orders with optional filtering by scope ('active' | 'all') or date ('YYYY-MM-DD').
 * Defaults to ?scope=active (current open cash session).
 * @param {{ scope?: 'active'|'all', date?: string }} [filters]
 * @returns {Promise<Array>}
 */
export function fetchOrders(filters = { scope: 'active' }) {
  const params = new URLSearchParams();
  if (filters?.date) {
    params.set('date', filters.date);
  } else {
    params.set('scope', filters?.scope || 'active');
  }

  return requestJson(`${ORDER_ENDPOINTS.ORDERS}?${params.toString()}`, {}, 'No se pudieron cargar las comandas.');
}

/**
 * Fetches the current cash register status to validate before creating orders.
 * @returns {Promise<{ isOpen: boolean, activeSession: Object|null }>}
 */
export function fetchCajaStatusForOrders() {
  return requestJson(ORDER_ENDPOINTS.CAJA_STATUS, {}, 'No se pudo verificar el estado de la caja.');
}

/**
 * Fetches a single order by ID with all details.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function fetchOrderById(id) {
  return requestJson(ORDER_ENDPOINTS.ORDER_DETAIL(id), {}, 'No se pudo obtener la comanda.');
}

/**
 * Creates a new order and triggers automatic warehouse inventory deduction.
 * The backend answers 400 with the reason in `error` (closed cash register, unavailable product,
 * insufficient stock...): that exact text is thrown so the UI can show it.
 * @param {{
 *   items: Array<{ productId: number, quantity: number, unitPrice?: number, notes?: string }>,
 *   notes?: string
 * }} data
 * @returns {Promise<Object>}
 */
export function createOrder(data) {
  return requestJson(ORDER_ENDPOINTS.ORDERS, { method: 'POST', body: data }, 'No se pudo crear la comanda.');
}

/**
 * Deletes or cancels an order by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function deleteOrder(id) {
  return requestJson(ORDER_ENDPOINTS.ORDER_DETAIL(id), { method: 'DELETE' }, 'No se pudo eliminar la comanda.');
}

/**
 * Fetches available products for placing orders.
 * @returns {Promise<Array>}
 */
export function fetchProductsForOrders() {
  return requestJson(`${ORDER_ENDPOINTS.PRODUCTS}?available=true`, {}, 'No se pudieron cargar los productos disponibles.');
}

/**
 * Fetches menu categories for POS order navigation.
 * @returns {Promise<Array>}
 */
export function fetchCategoriesForOrders() {
  return requestJson(ORDER_ENDPOINTS.CATEGORIES, {}, 'No se pudieron cargar las categorías.');
}
