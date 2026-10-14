# Plantillas de `endpoints.js` y service (ejemplo: Suppliers)

Todas las llamadas pasan por la capa HTTP compartida `frontend/src/config/apiFetch.js` (`requestJson`, `requestBlob`): ella añade el token, traduce el error de red a español, interpreta el `{ error }` del backend y cierra la sesión ante un 401. El service **no** define `safeFetch` ni `extractErrorMessage` ni llama a `fetch`.

## Contenido
- endpoints.js
- supplierService.js (CRUD completo)
- Variante: PATCH de estado
- Variante: descarga (blob) y subida (multipart)
- Petición pública (`skipAuth`)
- Qué responde la capa ante un error

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
 * Handles all HTTP requests for the suppliers module through the shared HTTP layer
 * (token, 401 handling and Spanish error messages live in config/apiFetch.js).
 */

import { requestJson } from '../../../config/apiFetch';
import { SUPPLIER_ENDPOINTS } from './endpoints';

/**
 * Fetches suppliers, optionally filtered by a search term.
 * @param {string} [searchTerm='']
 * @returns {Promise<Array>}
 */
export function fetchSuppliers(searchTerm = '') {
  const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  return requestJson(`${SUPPLIER_ENDPOINTS.SUPPLIERS}${query}`, {}, 'No se pudieron cargar los proveedores.');
}

/**
 * Fetches a single supplier by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export function fetchSupplierDetail(id) {
  return requestJson(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), {}, 'No se pudo obtener el proveedor.');
}

/**
 * Creates a supplier (admin only on the server).
 * @param {{ name: string, phone?: string|null, email?: string|null }} data
 * @returns {Promise<Object>}
 */
export function createSupplier(data) {
  return requestJson(SUPPLIER_ENDPOINTS.SUPPLIERS, { method: 'POST', body: data }, 'No se pudo crear el proveedor.');
}

/**
 * Updates a supplier. Omitted fields stay unchanged; null clears optional fields.
 * @param {number|string} id
 * @param {{ name?: string, phone?: string|null, email?: string|null, active?: boolean }} data
 * @returns {Promise<Object>}
 */
export function updateSupplier(id, data) {
  return requestJson(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), { method: 'PUT', body: data }, 'No se pudo actualizar el proveedor.');
}

/**
 * Deletes a supplier by ID. The backend answers 400 (with a Spanish message) if it has related records.
 * @param {number|string} id
 * @returns {Promise<{ message: string }>}
 */
export function deleteSupplier(id) {
  return requestJson(SUPPLIER_ENDPOINTS.SUPPLIER_DETAIL(id), { method: 'DELETE' }, 'No se pudo eliminar el proveedor.');
}
```

El tercer argumento es el mensaje genérico **sin prefijo**: si el backend no manda `{ error }`, la capa lo convierte en `Error (<status>): No se pudo crear el proveedor.`.

## Variante: PATCH de estado

```js
// endpoints.js
SUPPLIER_STATUS: (id) => `${getApiBaseUrl()}/api/suppliers/${id}/status`,

// supplierService.js
export function updateSupplierStatus(id, active) {
  return requestJson(SUPPLIER_ENDPOINTS.SUPPLIER_STATUS(id), { method: 'PATCH', body: { active } }, 'No se pudo cambiar el estado.');
}
```

## Variante: descarga (blob) y subida (multipart)

```js
import { requestBlob, requestJson } from '../../../config/apiFetch';

// Descarga: requestBlob lleva el token como cualquier petición (un <a href> o window.open NO puede mandarlo)
export async function downloadSuppliersReport() {
  const blob = await requestBlob(SUPPLIER_ENDPOINTS.EXPORT, {}, 'No se pudo exportar el reporte.');
  // ... crear un object URL y disparar la descarga (ver frontend-excel-import-export)
  return blob;
}

// Subida: con FormData requestJson NO pone Content-Type (el navegador añade el boundary)
export function importSuppliersExcel(file) {
  const formData = new FormData();
  formData.append('file', file); // el campo se llama "file" (multer.single('file'))
  return requestJson(SUPPLIER_ENDPOINTS.IMPORT, { method: 'POST', body: formData }, 'Falló la importación masiva.');
}
```

## Petición pública (`skipAuth`)

Solo el login es público. `skipAuth: true` envía la petición sin token y evita que un 401 ("credenciales incorrectas") cierre la sesión:

```js
// frontend/src/app/auth/services/authService.js
export async function loginUser(credentials) {
  const data = await requestJson(AUTH_ENDPOINTS.LOGIN, { method: 'POST', body: credentials, skipAuth: true }, 'Credenciales inválidas.');
  // ... valida { user, token } y devuélvelos; AuthContext guarda la sesión
}
```

No uses `skipAuth` en ninguna otra ruta: el test de estructura exige que solo aparezca en `authService.js` y `apiFetch.js`.

## Qué responde la capa ante un error

| Situación | `Error.message` que recibe tu `catch` |
|---|---|
| El backend responde `{ error: 'texto' }` (400, 403, 404...) | `texto` (+ `: details` solo si `details` es texto) |
| El backend no manda `{ error }` o el cuerpo no es JSON (p. ej. un 502 de un proxy) | `Error (<status>): <mensaje genérico>` |
| Servidor caído, sin red o CORS | `No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté en ejecución.` |
| 401 con token | igual que arriba **y además** la sesión se cierra y la app vuelve a `/login` con aviso (no tienes que hacer nada) |
| 403 | el texto del servidor; la sesión sigue abierta: muéstralo con `showErrorAlert` |
