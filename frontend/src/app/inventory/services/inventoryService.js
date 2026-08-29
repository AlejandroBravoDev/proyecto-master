/**
 * Inventory Service Layer
 * Handles all HTTP requests for ingredients, stock adjustments, Kardex movements,
 * template downloading, report exporting, and bulk Excel importing.
 */

import { INVENTORY_ENDPOINTS } from './endpoints';

/**
 * Fetches the list of all ingredients.
 * @returns {Promise<Array>}
 */
export async function fetchIngredients() {
  const response = await fetch(INVENTORY_ENDPOINTS.INGREDIENTS, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron cargar los insumos.`);
  }

  return response.json();
}

/**
 * Fetches detail and last 20 Kardex movements of an ingredient.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchIngredientDetail(id) {
  const response = await fetch(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener el detalle del insumo.`);
  }

  return response.json();
}

/**
 * Creates a new ingredient in warehouse.
 * @param {{name: string, description?: string, measurementUnit: string, currentStock?: number, minimumStock?: number, unitCost?: number}} data
 * @returns {Promise<Object>}
 */
export async function createIngredient(data) {
  const response = await fetch(INVENTORY_ENDPOINTS.INGREDIENTS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo crear el insumo.`);
  }

  return response.json();
}

/**
 * Updates an ingredient's basic info or performs a manual stock adjustment.
 * @param {number|string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function updateIngredient(id, data) {
  const response = await fetch(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo actualizar el insumo.`);
  }

  return response.json();
}

/**
 * Deletes an ingredient from catalog.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function deleteIngredient(id) {
  const response = await fetch(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error (${response.status}): No se pudo eliminar el insumo.`);
  }

  return response.json();
}

/**
 * Fetches critical stock alert ingredients.
 * @returns {Promise<Array>}
 */
export async function fetchInventoryAlerts() {
  const response = await fetch(INVENTORY_ENDPOINTS.ALERTS, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudieron obtener las alertas de inventario.`);
  }

  return response.json();
}

/**
 * Fetches Kardex inventory movements with optional filters.
 * @param {{ingredientId?: number|string, type?: 'IN'|'OUT'|'ADJUSTMENT', reason?: string}} filters
 * @returns {Promise<Array>}
 */
export async function fetchInventoryMovements(filters = {}) {
  const query = new URLSearchParams();
  if (filters.ingredientId) query.append('ingredientId', filters.ingredientId);
  if (filters.type) query.append('type', filters.type);
  if (filters.reason) query.append('reason', filters.reason);

  const url = `${INVENTORY_ENDPOINTS.MOVEMENTS}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo obtener el historial de Kardex.`);
  }

  return response.json();
}

/**
 * Downloads the Excel template for bulk ingredients upload.
 */
export async function downloadIngredientsTemplate() {
  const response = await fetch(INVENTORY_ENDPOINTS.TEMPLATE, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo descargar la plantilla de insumos.`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_carga_ingredientes.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Downloads the full inventory report in Excel format.
 */
export async function exportIngredientsReport() {
  const response = await fetch(INVENTORY_ENDPOINTS.EXPORT, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo exportar el reporte de inventario.`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reporte_inventario_ingredientes.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Uploads an Excel file to bulk import/update ingredients.
 * @param {File} file
 * @returns {Promise<{message: string, summary: {created: number, updated: number, skipped: number, errors: Array<string>}}>}
 */
export async function importIngredientsExcel(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(INVENTORY_ENDPOINTS.IMPORT, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error (${response.status}): Falló la importación masiva de insumos.`);
  }

  return data;
}
