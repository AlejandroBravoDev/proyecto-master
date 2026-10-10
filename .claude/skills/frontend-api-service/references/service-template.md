# Plantillas de `endpoints.js` y service (ejemplo: Suppliers)

## Contenido
- endpoints.js
- supplierService.js (CRUD completo)
- Variante: PATCH de estado
- Variante compacta con helper `request()`

## endpoints.js

```js
// frontend/src/app/suppliers/services/endpoints.js
/**
 * Centralized API endpoints registry for the Suppliers module.
 * URLs are built lazily with getApiBaseUrl() (VITE_API_URL host + /api path).
 */

import { getApiBaseUrl } from '../../../config/api';

export const SUPPLIER_ENDPOINTS = {
  get SUPPLIERS() { return `${getApiBaseUrl()}/api/suppliers`; },
  SUPPLIER_DETAIL: (id) => `${getApiBaseUrl()}/api/suppliers/${id}`,
};
```

## supplierService.js

```js
// frontend/src/app/suppliers/services/supplierService.js
/**
 * Suppliers Service Layer
 * Handles all HTTP requests for the suppliers module.
 */

import { SUPPLIER_ENDPOINTS } from './endpoints';

/**
 * fetch() rejects with TypeError("Failed to fetch") when the server is unreachable
 * (backend stopped, no network, CORS). Surface a Spanish message instead of the raw browser text.
 */
async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté en ejecución.');
  }
}

/**
 * Builds the user-facing message from a failed backend response body.
 * The backend answers errors as { error: 'message', details?: ... }.
 * @param {Object|null} errorData
 * @param {string} fallbackMessage
 * @returns {string}
 */
function extractErrorMessage(errorData, fallbackMessage) {
  if (!errorData) return fallbackMessage;
  return errorData.error || errorData.message || fallbackMessage;
}

/**
 * Fetches suppliers, optionally filtered by a search term.
 * @param {string} [searchTerm='']
 * @returns {Promise<Array>}
 */
export async function fetchSuppliers(searchTerm = '') {
  const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  const response = await safeFetch(`${SUPPLIER_ENDPOINTS.SUPPLIERS}${query}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudieron cargar los proveedores.`));
  }

  return response.json();
}

/**
 * Fetches a single supplier by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function fetchSupplierDetail(id) {
  const response = await safeFetch(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo obtener el proveedor.`));
  }

  return response.json();
}

/**
 * Creates a supplier.
 * @param {{ name: string, phone?: string|null, email?: string|null }} data
 * @returns {Promise<Object>}
 */
export async function createSupplier(data) {
  const response = await safeFetch(SUPPLIER_ENDPOINTS.SUPPLIERS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo crear el proveedor.`));
  }

  return response.json();
}

/**
 * Updates a supplier. Omitted fields stay unchanged; null clears optional fields.
 * @param {number|string} id
 * @param {{ name?: string, phone?: string|null, email?: string|null, active?: boolean }} data
 * @returns {Promise<Object>}
 */
export async function updateSupplier(id, data) {
  const response = await safeFetch(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo actualizar el proveedor.`));
  }

  return response.json();
}

/**
 * Deletes a supplier by ID.
 * @param {number|string} id
 * @returns {Promise<{ message: string }>}
 */
export async function deleteSupplier(id) {
  const response = await safeFetch(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo eliminar el proveedor.`));
  }

  return response.json();
}
```

## Variante: PATCH de estado

```js
// endpoints.js
SUPPLIER_STATUS: (id) => `${getApiBaseUrl()}/api/suppliers/${id}/status`,

// supplierService.js
export async function updateSupplierStatus(id, active) {
  const response = await safeFetch(SUPPLIER_ENDPOINTS.SUPPLIER_STATUS(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): No se pudo cambiar el estado.`));
  }

  return response.json();
}
```

## Variante compacta con helper `request()`

Permitida en archivos nuevos cuando el service tiene más de ~5 funciones (reduce el boilerplate sin cambiar el comportamiento). El helper es local al archivo.

```js
async function request(url, { method = 'GET', body } = {}, fallbackMessage) {
  const response = await safeFetch(url, {
    method,
    headers: {
      'Accept': 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(errorData, `Error (${response.status}): ${fallbackMessage}`));
  }

  return response.json();
}

export const fetchSuppliers = () => request(SUPPLIER_ENDPOINTS.SUPPLIERS, {}, 'No se pudieron cargar los proveedores.');
export const createSupplier = (data) => request(SUPPLIER_ENDPOINTS.SUPPLIERS, { method: 'POST', body: data }, 'No se pudo crear el proveedor.');
```
