/**
 * Orders Service Layer
 * Handles all HTTP requests for order creation, listing, detail viewing, cancellation,
 * and menu lookups for the POS order taking interface.
 */

import { ORDER_ENDPOINTS } from './endpoints';

/**
 * Fetches the list of all orders with orderDetails, product info, and sale status.
 * @returns {Promise<Array>}
 */
export async function fetchOrders() {
  const response = await fetch(ORDER_ENDPOINTS.ORDERS, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar las comandas.`);
  }

  return response.json();
}

/**
 * Fetches a single order by ID with all details.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchOrderById(id) {
  const response = await fetch(ORDER_ENDPOINTS.ORDER_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener la comanda.`);
  }

  return response.json();
}

/**
 * Creates a new order and triggers automatic warehouse inventory deduction.
 * @param {{
 *   items: Array<{ productId: number, quantity: number, unitPrice?: number, notes?: string }>,
 *   notes?: string
 * }} data
 * @returns {Promise<Object>}
 */
export async function createOrder(data) {
  const response = await fetch(ORDER_ENDPOINTS.ORDERS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo crear la comanda.`);
  }

  return response.json();
}

/**
 * Deletes or cancels an order by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function deleteOrder(id) {
  const response = await fetch(ORDER_ENDPOINTS.ORDER_DETAIL(id), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo eliminar la comanda.`);
  }

  return response.json();
}

/**
 * Fetches available products for placing orders.
 * @returns {Promise<Array>}
 */
export async function fetchProductsForOrders() {
  const response = await fetch(`${ORDER_ENDPOINTS.PRODUCTS}?available=true`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar los productos disponibles.`);
  }

  return response.json();
}

/**
 * Fetches menu categories for POS order navigation.
 * @returns {Promise<Array>}
 */
export async function fetchCategoriesForOrders() {
  const response = await fetch(ORDER_ENDPOINTS.CATEGORIES, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar las categorías.`);
  }

  return response.json();
}
