/**
 * Inventory Service Layer
 * Handles all HTTP requests for ingredients, stock adjustments, Kardex movements,
 * template downloading, report exporting, and bulk Excel importing.
 */

import { requestBlob, requestJson } from '../../../config/apiFetch';
import { INVENTORY_ENDPOINTS } from './endpoints';

/**
 * Fetches the list of all ingredients.
 * @returns {Promise<Array>}
 */
export function fetchIngredients() {
  return requestJson(INVENTORY_ENDPOINTS.INGREDIENTS, {}, 'No se pudieron cargar los insumos.');
}

/**
 * Fetches detail and last 20 Kardex movements of an ingredient.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function fetchIngredientDetail(id) {
  return requestJson(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), {}, 'No se pudo obtener el detalle del insumo.');
}

/**
 * Creates a new ingredient in warehouse.
 * @param {{name: string, description?: string, measurementUnit: string, currentStock?: number, minimumStock?: number, unitCost?: number}} data
 * @returns {Promise<Object>}
 */
export function createIngredient(data) {
  return requestJson(INVENTORY_ENDPOINTS.INGREDIENTS, { method: 'POST', body: data }, 'No se pudo crear el insumo.');
}

/**
 * Updates an ingredient's basic info or performs a manual stock adjustment.
 * @param {number|string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export function updateIngredient(id, data) {
  return requestJson(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), { method: 'PUT', body: data }, 'No se pudo actualizar el insumo.');
}

/**
 * Deletes an ingredient from catalog.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function deleteIngredient(id) {
  return requestJson(INVENTORY_ENDPOINTS.INGREDIENT_DETAIL(id), { method: 'DELETE' }, 'No se pudo eliminar el insumo.');
}

/**
 * Fetches critical stock alert ingredients.
 * @returns {Promise<Array>}
 */
export function fetchInventoryAlerts() {
  return requestJson(INVENTORY_ENDPOINTS.ALERTS, {}, 'No se pudieron obtener las alertas de inventario.');
}

/**
 * Fetches Kardex inventory movements with optional filters.
 * @param {{ingredientId?: number|string, type?: 'IN'|'OUT'|'ADJUSTMENT', reason?: string}} filters
 * @returns {Promise<Array>}
 */
export function fetchInventoryMovements(filters = {}) {
  const query = new URLSearchParams();
  if (filters.ingredientId) query.append('ingredientId', filters.ingredientId);
  if (filters.type) query.append('type', filters.type);
  if (filters.reason) query.append('reason', filters.reason);

  const url = `${INVENTORY_ENDPOINTS.MOVEMENTS}${query.toString() ? `?${query.toString()}` : ''}`;
  return requestJson(url, {}, 'No se pudo obtener el historial de Kardex.');
}

/**
 * Downloads a binary file from the backend and hands it to the browser as a file save.
 * @param {string} url
 * @param {string} filename name proposed to the user
 * @param {string} fallbackMessage generic error text (Spanish, without the "Error (N):" prefix)
 */
async function downloadFile(url, filename, fallbackMessage) {
  const blob = await requestBlob(url, {}, fallbackMessage);
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

/**
 * Downloads the Excel template for bulk ingredients upload.
 */
export function downloadIngredientsTemplate() {
  return downloadFile(
    INVENTORY_ENDPOINTS.TEMPLATE,
    'plantilla_carga_ingredientes.xlsx',
    'No se pudo descargar la plantilla de insumos.'
  );
}

/**
 * Downloads the full inventory report in Excel format.
 */
export function exportIngredientsReport() {
  return downloadFile(
    INVENTORY_ENDPOINTS.EXPORT,
    'reporte_inventario_ingredientes.xlsx',
    'No se pudo exportar el reporte de inventario.'
  );
}

/**
 * Uploads an Excel file to bulk import/update ingredients.
 * @param {File} file
 * @returns {Promise<{message: string, summary: {created: number, updated: number, skipped: number, errors: Array<string>}}>}
 */
export function importIngredientsExcel(file) {
  const formData = new FormData();
  formData.append('file', file);

  return requestJson(INVENTORY_ENDPOINTS.IMPORT, { method: 'POST', body: formData }, 'Falló la importación masiva de insumos.');
}
