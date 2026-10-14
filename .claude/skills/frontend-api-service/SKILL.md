---
name: frontend-api-service
description: Agrega o modifica llamadas HTTP del frontend - services/endpoints.js con getApiBaseUrl(), funciones en services/*Service.js sobre la capa compartida config/apiFetch.js (requestJson, requestBlob), token de sesión y 401/403, manejo de errores, query params, PATCH, blobs y multipart. Úsala siempre que haya que consumir un endpoint nuevo o cambiado desde React, o al arreglar URLs, CORS, VITE_API_URL, 401/403 o errores 404/500 al llamar a la API.
---

# Frontend: capa de servicios (endpoints + capa HTTP compartida)

Cada feature habla con el backend solo a través de dos archivos: `services/endpoints.js` (URLs) y `services/<feature>Service.js` (funciones que llaman a la **capa HTTP única** `src/config/apiFetch.js`). Las páginas y componentes **nunca** llaman a `fetch` ni arman URLs, y los services tampoco llaman a `fetch`: usan `requestJson` / `requestBlob`. Así hay un único sitio que tocar cuando cambia la API, el token viaja siempre igual y los errores se tratan igual en todas partes. Plantillas completas en `references/service-template.md`.

## La capa HTTP `config/apiFetch.js` (obligatoria)

| Función | Para qué |
|---|---|
| `requestJson(url, { method, body, headers, skipAuth }, fallbackMessage)` | petición JSON (o `FormData`) que valida `response.ok` y devuelve el JSON. **Lo normal en un service** |
| `requestBlob(url, { method, headers }, fallbackMessage)` | igual, pero devuelve el `Blob` (descarga de Excel) |
| `apiFetch(url, options)` | `fetch` con sesión y error de red en español; devuelve la `Response` sin validar `ok` (la usan las dos de arriba; casi nunca la llamas tú) |
| `extractErrorMessage`, `NETWORK_ERROR_MESSAGE` | texto de error legible / mensaje cuando el servidor no responde (los usa la propia capa) |
| `getAuthHeaders`, `setUnauthorizedHandler` | internos de la sesión (`AuthContext` registra el handler); no los uses en una feature |

Qué hace por ti (no lo reimplementes):
- **Token**: añade `Authorization: Bearer <token>` (leído de `app/auth/authStorage.js`) a cada petición. Nunca leas el token ni `sessionStorage`, ni escribas `Authorization`, fuera de la capa HTTP y la sesión: `frontend/tests/config/project-structure.test.js` lo prohíbe (y también `XMLHttpRequest`/`WebSocket`, `window.open` o `<a href>` hacia la API: no pueden mandar la cabecera).
- **401** en una petición con token: borra la sesión guardada, avisa a `AuthContext` **una sola vez** (aunque haya varias peticiones paralelas) y la app vuelve a `/login` con el aviso "Tu sesión expiró. Inicia sesión de nuevo." y regresa a la pantalla de origen al entrar. **403** (rol sin permiso o turno ajeno): no toca la sesión; lanza `Error` con el texto del servidor ("No tienes permisos para realizar esta acción.") para mostrarlo con `showErrorAlert`.
- **`skipAuth: true`**: petición pública sin token y sin efecto de 401. Solo la usa el login (`authService`); el test de estructura exige que sea el único.
- **Errores**: `{ error }` del backend en español (+ `details` solo si es texto, nunca un objeto); sin cuerpo útil -> `Error (<status>): <fallbackMessage>`; servidor caído -> "No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté en ejecución." (ya no verás "Failed to fetch").
- **Cabeceras**: `Accept: application/json` siempre; `Content-Type: application/json` solo con body JSON; con `FormData` **no** se pone `Content-Type` (el navegador añade el `boundary`).

## Reglas de `endpoints.js`

- Construye URLs con `getApiBaseUrl()` de `src/config/api.js` e incluye el prefijo **`/api`** en la ruta:
  ```js
  import { getApiBaseUrl } from '../../../config/api';

  export const SUPPLIER_ENDPOINTS = {
    get SUPPLIERS() { return `${getApiBaseUrl()}/api/suppliers`; },          // estática -> getter
    SUPPLIER_DETAIL: (id) => `${getApiBaseUrl()}/api/suppliers/${id}`,        // con parámetro -> función
  };
  ```
  Los getters/funciones se evalúan al llamar (no al importar), igual que el resto de features.
- **Nunca** leas `import.meta.env.VITE_API_URL` directo (en un build sin esa variable la URL queda `undefined/api/...`). `getApiBaseUrl()` resuelve: `VITE_API_URL` -> `''` en producción (misma origin) -> `http://localhost:3001` en desarrollo.
- `VITE_API_URL` es **solo el host** (`https://midominio.com`), sin `/api`. Con `/api` al final las URLs quedan `/api/api/...`. En desarrollo normalmente no hace falta `.env`.
- Una feature que necesita datos de otra declara esa URL en **su propio** `endpoints.js` (como `ORDER_ENDPOINTS.PRODUCTS` o `CAJA_ENDPOINTS.USERS`) y la consume desde **su** service; no importes el service de otra feature.
- Nombre del objeto: `<FEATURE>_ENDPOINTS` en MAYÚSCULAS.

## Reglas de `<feature>Service.js`

1. Una función exportada con nombre por operación: `fetchX` (lista), `fetchXDetail`, `createX`, `updateX`, `deleteX`, y verbos específicos (`updateUserStatus`, `openCajaSession`). Basta con devolver `requestJson(...)`; usa `async` solo si procesas el resultado.
2. Importa `requestJson` / `requestBlob` de `../../../config/apiFetch` y pásale el **mensaje genérico en español sin prefijo** como tercer argumento (`'No se pudo crear el proveedor.'`): la capa lo convierte en `Error (<status>): ...` si el servidor no manda `{ error }`.
3. Devuelve el JSON tal cual (el backend responde JSON crudo, sin `{ data }`). Normalizaciones livianas (asegurar arrays, p. ej. `fetchUsers` acepta array o `{ users }`) están bien; **sin datos simulados ni valores de respaldo falsos**.
4. Query params con `URLSearchParams` o `encodeURIComponent`; omite los vacíos. Los endpoints con paginación de servidor (`GET /api/users`, `/api/inventory/movements`) devuelven `{ total, page, limit, totalPages, <items> }` solo si envías `page`/`limit`.
5. Actualizaciones parciales: `undefined` se omite en `JSON.stringify` (el backend no toca el campo); `null` se envía y **limpia** la columna. Si el formulario permite vaciar un campo opcional al editar, envía `null`.
6. **Lo que envías debe ser lo que el rol admite**: algunas rutas aceptan al WORKER solo ciertos campos (`PUT /api/products/:id` solo `available`; `PUT /api/ingredients/:id` solo `adjustStock`/`adjustReason`); un campo de más da 403. Consulta `fullstack-domain-reference/references/users-roles.md` antes de reutilizar un `updateX` desde una pantalla de WORKER.
7. JSDoc en inglés (`@param`, `@returns`), mensajes de error en español, sin lógica de UI ni de negocio.
8. Descarga de archivos (`requestBlob`) y subida (`FormData`): ver `frontend-excel-import-export`. Las descargas **nunca** van por enlace directo.

## Pasos para consumir un endpoint nuevo

1. Confirma el contrato y el rol en `.claude/skills/fullstack-domain-reference/references/api-endpoints.md` y `users-roles.md` (o créalo con `backend-new-module` primero).
2. Agrega la URL en `endpoints.js`.
3. Agrega la función en el service con `requestJson` (copia la plantilla del verbo que corresponda).
4. Úsala desde la página: `await fn(...)` dentro de `try/catch`; muestra errores según `frontend-alerts-dialogs`; recarga datos si hubo cambios.
5. Pruébalo con el backend corriendo (con un `ADMIN` y un `WORKER`) y con el backend **detenido** (la página debe mostrar el estado de error con "Reintentar", no quedarse en blanco).
6. Escribe su prueba (`frontend-testing`): URL + método + cuerpo + un error con mensaje en español.

## Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| Petición a `undefined/api/...` | se leyó `import.meta.env.VITE_API_URL` directo |
| Petición a `/api/api/...` | `VITE_API_URL` termina en `/api` |
| `404` en una ruta que existe | ruta estática registrada después de `/:id` en el backend, o falta `/api` en el endpoint |
| Error de CORS en dev / "No se pudo conectar con el servidor" con el backend vivo | el backend tiene un `FRONTEND_URL` que no incluye el origen exacto del frontend (p. ej. `http://localhost:5173`); el log del backend dice `[CORS] Origen no permitido` |
| En producción llama a `localhost` | build con `VITE_API_URL` apuntando a localhost; en producción déjala vacía |
| La app vuelve a `/login` de golpe con "Tu sesión expiró" | 401: token vencido (12 h), usuario desactivado, contraseña cambiada o backend reiniciado sin `JWT_SECRET` fijo |
| `No tienes permisos para realizar esta acción.` al guardar | 403: la ruta es solo admin o el cuerpo trae un campo que el WORKER no puede enviar |
| `Demasiados intentos` / 429 | límite de tasa del login (10 fallos / 15 min por IP) o de `/api` (600 / min) |
| Mensaje "Error (500): ..." sin texto útil | el backend no devolvió `{ error }`; corrige el controller |
| "Failed to fetch" en pantalla | alguien llamó a `fetch` directo en vez de usar `requestJson` (el test `project-structure` lo detecta) |

## Terminado cuando

- [ ] Ninguna URL escrita a mano fuera de `endpoints.js`; ningún `import.meta.env.VITE_API_URL` fuera de `config/api.js`; ningún `fetch(` fuera de `config/apiFetch.js`.
- [ ] Todas las funciones usan `requestJson` / `requestBlob` con un mensaje genérico en español.
- [ ] El cuerpo que envía cada acción es el que su rol admite (probado con un WORKER).
- [ ] `npm run build` y `npm test` (frontend) sin errores.
