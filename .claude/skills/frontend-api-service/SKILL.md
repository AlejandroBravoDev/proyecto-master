---
name: frontend-api-service
description: Agrega o modifica llamadas HTTP del frontend - services/endpoints.js con getApiBaseUrl(), funciones fetch en services/*Service.js, manejo de errores, query params, PATCH, blobs y multipart. Úsala siempre que haya que consumir un endpoint nuevo o cambiado desde React, o al arreglar URLs, CORS, VITE_API_URL o errores 404/500 al llamar a la API.
---

# Frontend: capa de servicios (endpoints + fetch)

Cada feature habla con el backend solo a través de dos archivos: `services/endpoints.js` (URLs) y `services/<feature>Service.js` (funciones `fetch`). Las páginas y componentes **nunca** llaman a `fetch` ni arman URLs. Así hay un único sitio que tocar cuando cambia la API y los errores se tratan igual en todas partes. Plantillas completas en `references/service-template.md`.

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
- **Nunca** leas `import.meta.env.VITE_API_URL` directo (el dashboard lo hace y queda `undefined/api/...` en producción). `getApiBaseUrl()` resuelve: `VITE_API_URL` -> `''` en producción (misma origin) -> `http://localhost:3001` en desarrollo.
- `VITE_API_URL` es **solo el host** (`https://midominio.com`), sin `/api`. Con `/api` al final las URLs quedan `/api/api/...`. En desarrollo normalmente no hace falta `.env`.
- Una feature que necesita datos de otra declara esa URL en **su propio** `endpoints.js` (como `ORDER_ENDPOINTS.PRODUCTS` o `CAJA_ENDPOINTS.USERS`) y la consume desde **su** service; no importes el service de otra feature.
- Nombre del objeto: `<FEATURE>_ENDPOINTS` en MAYÚSCULAS.

## Reglas de `<feature>Service.js`

1. Una función `async` por operación, exportada con nombre: `fetchX` (lista), `fetchXDetail`, `createX`, `updateX`, `deleteX`, y verbos específicos (`updateUserStatus`, `openCajaSession`).
2. Cabeceras: `Accept: application/json` siempre; `Content-Type: application/json` solo cuando hay body (`JSON.stringify(data)`). **No** pongas `Content-Type` en `FormData`: el navegador agrega el `boundary`.
3. Tras cada llamada: `if (!response.ok)` -> lee el cuerpo con `await response.json().catch(() => ({}))` y lanza `new Error(extractErrorMessage(errorData, 'Error (<status>): No se pudo ...'))`. El backend responde `{ error: 'mensaje en español' }`; ese texto es el que verá el usuario.
   Llama a `safeFetch(url, options)` (helper local de la plantilla) en vez de `fetch` directo: cuando el servidor no responde, el navegador rechaza con `TypeError: Failed to fetch` (en inglés, y es lo que hoy ven los usuarios al caerse el backend); `safeFetch` lo convierte en "No se pudo conectar con el servidor...".
4. Devuelve `response.json()` (el backend responde JSON crudo, sin `{ data }`). Normalizaciones livianas (asegurar arrays) están bien; **sin datos simulados ni valores de respaldo falsos**.
5. Query params con `URLSearchParams` o `encodeURIComponent`; omite los vacíos.
6. Actualizaciones parciales: `undefined` se omite en `JSON.stringify` (el backend no toca el campo); `null` se envía y **limpia** la columna. Si el formulario permite vaciar un campo opcional al editar, envía `null`.
7. JSDoc en inglés (`@param`, `@returns`), mensajes de error en español, sin lógica de UI ni de negocio.
8. Descarga de archivos (`blob`) y subida (`FormData`): ver `frontend-excel-import-export`.

Dos estilos de error coexisten hoy: `errorData.error || fallback` (products, inventory) y `extractErrorMessage` que además concatena `details` (auth, users, orders, caja). Para archivos nuevos usa la versión simple (sin `details`: son textos técnicos para el desarrollador y se ven mal en la UI). Al añadir una función a un service existente, imita el estilo de ese archivo.

## Pasos para consumir un endpoint nuevo

1. Confirma el contrato en `.claude/skills/fullstack-domain-reference/references/api-endpoints.md` (o créalo con `backend-new-module` primero).
2. Agrega la URL en `endpoints.js`.
3. Agrega la función en el service (copiando la plantilla del verbo que corresponda).
4. Úsala desde la página: `await fn(...)` dentro de `try/catch`; muestra errores según `frontend-alerts-dialogs`; recarga datos si hubo cambios.
5. Pruébalo con el backend corriendo, y con el backend **detenido** (la página debe mostrar el estado de error con "Reintentar", no quedarse en blanco).

## Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| Petición a `undefined/api/...` | se leyó `import.meta.env.VITE_API_URL` directo |
| Petición a `/api/api/...` | `VITE_API_URL` termina en `/api` |
| `404` en una ruta que existe | ruta estática registrada después de `/:id` en el backend, o falta `/api` en el endpoint |
| Error de CORS en dev | backend con `FRONTEND_URL` que no incluye `http://localhost:5173` |
| En producción llama a `localhost` | build con `VITE_API_URL` apuntando a localhost; en producción déjala vacía |
| Mensaje "Error (500): ..." sin texto útil | el backend no devolvió `{ error }`; corrige el controller |
| "Failed to fetch" en pantalla | el servicio llama a `fetch` sin `safeFetch`, o el backend está caído / URL o CORS incorrectos |

## Terminado cuando

- [ ] Ninguna URL escrita a mano fuera de `endpoints.js`; ningún `import.meta.env.VITE_API_URL` fuera de `config/api.js`.
- [ ] Todas las funciones validan `response.ok` y lanzan `Error` con mensaje en español.
- [ ] `npm run build` (frontend) sin errores.
