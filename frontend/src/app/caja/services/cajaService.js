/**
 * Caja & Sales Service Layer
 * Handles all HTTP requests for sales listing, invoice detail, and direct register sales.
 */

import { CAJA_ENDPOINTS } from './endpoints';

/**
 * Fetches all sales / invoices history.
 * @returns {Promise<Array>}
 */
export async function fetchSales() {
  const response = await fetch(CAJA_ENDPOINTS.SALES, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar las facturas de caja.`);
  }

  return response.json();
}

/**
 * Fetches detail of a single sale / invoice by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchSaleDetail(id) {
  const response = await fetch(CAJA_ENDPOINTS.SALE_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener el detalle de la factura.`);
  }

  return response.json();
}

/**
 * Registers a direct sale in cash register.
 * @param {{
 *   paymentMethod: 'CASH'|'CARD'|'TRANSFER'|'MIXED',
 *   tax?: number,
 *   discount?: number,
 *   items: Array<{ productId: number, quantity: number, unitPrice?: number }>
 * }} data
 * @returns {Promise<Object>}
 */
export async function createDirectSale(data) {
  const response = await fetch(CAJA_ENDPOINTS.SALES, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo registrar la venta.`);
  }

  return response.json();
}

/**
 * Fetches available products for direct cashier checkout.
 * @returns {Promise<Array>}
 */
export async function fetchProductsForSale() {
  const response = await fetch(`${CAJA_ENDPOINTS.PRODUCTS}?available=true`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar los productos.`);
  }

  return response.json();
}
