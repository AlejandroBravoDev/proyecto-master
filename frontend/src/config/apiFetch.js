/**
 * Capa HTTP compartida del frontend.
 *
 * TODOS los services (`src/app/<feature>/services/*Service.js`) llaman al backend a través de este
 * módulo y nunca con `fetch` directo. Así hay un único sitio donde:
 *  - un fallo de red ("Failed to fetch") se convierte en un mensaje en español;
 *  - se interpreta el cuerpo de error del backend (`{ error, details? }`);
 *  - se inyecta la sesión: `Authorization: Bearer <token>` en cada petición (ver `getAuthHeaders`);
 *  - un 401 cierra la sesión y avisa a la app (ver `setUnauthorizedHandler`).
 *
 * Funciones exportadas:
 *  - `getAuthHeaders()`          cabecera `Authorization` con el token guardado (o `{}` sin sesión).
 *  - `setUnauthorizedHandler()`  registra quién se entera de que la sesión dejó de ser válida (401).
 *  - `apiFetch(url, opts)`       `fetch` + sesión + cabeceras comunes + error de red en español.
 *  - `extractErrorMessage()`     texto de error legible a partir del cuerpo de una respuesta fallida.
 *  - `requestJson()`             petición JSON (o multipart) que valida `response.ok` y devuelve el JSON.
 *  - `requestBlob()`             igual, pero devuelve el `Blob` (descarga de Excel).
 *
 * El token vive en `app/auth/authStorage.js` (sin React) para que este módulo no dependa de la app.
 */
import { clearStoredSession, getStoredToken } from '../app/auth/authStorage';

/** Mensaje que ve el usuario cuando el servidor no responde (backend caído, sin red, CORS). */
export const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté en ejecución.';

/**
 * Cabeceras de autenticación que `apiFetch` añade a la petición.
 *
 * Devuelve `{ Authorization: 'Bearer <token>' }` si hay token guardado y `{}` si no. Sin argumento
 * lee el token de `authStorage`; `apiFetch` pasa el token que ya leyó (o `null` en las peticiones
 * públicas) para usar exactamente el mismo valor al enviar y al interpretar un 401.
 *
 * @param {string|null} [token] token a usar; por defecto, el de la sesión guardada
 * @returns {Record<string, string>}
 */
export function getAuthHeaders(token = getStoredToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Quién se entera de que el servidor rechazó el token (401): lo registra `AuthProvider`.
 * @type {((info: { code: string|null, message: string|null }) => void)|null}
 */
let unauthorizedHandler = null;

/**
 * Registra la función que `apiFetch` llama (una sola vez por sesión caída) cuando una petición
 * autenticada recibe un 401. Recibe `{ code, message }` con el `code` (`NO_TOKEN`, `INVALID_TOKEN`,
 * `TOKEN_EXPIRED`, `USER_INACTIVE`) y el `error` que mandó el servidor (`null` si no vinieron).
 * `apiFetch` ya habrá borrado la sesión guardada; el handler solo actualiza la app (usuario `null`).
 * Es un patrón de "handler registrado" para no importar React ni recargar la página desde aquí.
 *
 * @param {((info: { code: string|null, message: string|null }) => void)|null} handler
 * @returns {() => void} función que quita el handler (solo si sigue siendo el registrado)
 */
export function setUnauthorizedHandler(handler) {
  const next = typeof handler === 'function' ? handler : null;
  unauthorizedHandler = next;
  return () => {
    if (unauthorizedHandler === next) unauthorizedHandler = null;
  };
}

/** Devuelve el texto si es un string no vacío; si no, `''`. */
function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Lee `code` y `error` del cuerpo de un 401 SIN consumir el de la respuesta original (se lee una
 * copia: el service todavía necesita el cuerpo para armar su mensaje de error).
 * @param {Response} response
 * @returns {Promise<{ code: string|null, message: string|null }>}
 */
async function readUnauthorizedReason(response) {
  try {
    const body = await response.clone().json();
    return { code: asText(body?.code) || null, message: asText(body?.error) || null };
  } catch {
    return { code: null, message: null };
  }
}

/**
 * Cierra la sesión guardada y avisa a la app tras un 401 de una petición autenticada.
 *
 * Solo actúa si el token guardado sigue siendo el que viajó en la petición: así varias peticiones
 * paralelas con 401 cierran la sesión UNA vez (la primera borra el token, las demás ven que ya no
 * coincide), y un 401 tardío de una sesión anterior no cierra una sesión nueva. La comprobación y el
 * borrado son síncronos (antes de cualquier `await`), por eso no hay carrera entre peticiones.
 *
 * @param {Response} response
 * @param {string} sentToken token que se envió en esa petición
 */
async function handleUnauthorized(response, sentToken) {
  if (getStoredToken() !== sentToken) return;
  clearStoredSession();
  const reason = await readUnauthorizedReason(response);
  try {
    unauthorizedHandler?.(reason);
  } catch {
    /* un fallo al avisar a la pantalla no debe ocultar el error de la petición */
  }
}

/**
 * `fetch` que añade la sesión (`getAuthHeaders()`) y traduce el rechazo de red a un `Error` en español.
 * Las cabeceras que pase el llamador tienen prioridad sobre las comunes.
 * Devuelve la `Response` tal cual (no valida `ok`: eso lo hacen `requestJson` / `requestBlob`).
 *
 * `fetch` rechaza con `TypeError: Failed to fetch` (en inglés) cuando no hay respuesta del
 * servidor; las respuestas HTTP 4xx/5xx NO rechazan.
 *
 * Opción propia `skipAuth: true`: petición pública (el login). No lleva token y un 401 no cierra
 * la sesión (es "credenciales incorrectas", no "sesión caducada").
 *
 * Un 401 en una petición que SÍ llevó token borra la sesión guardada y llama al handler de
 * `setUnauthorizedHandler`. Un 403 (rol insuficiente) no toca la sesión.
 *
 * @param {string} url
 * @param {RequestInit & { skipAuth?: boolean }} [options]
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const sentToken = skipAuth ? null : getStoredToken();
  const headers = { ...getAuthHeaders(sentToken), ...(fetchOptions.headers || {}) };

  let response;
  try {
    response = await fetch(url, { ...fetchOptions, headers });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 401 && sentToken) await handleUnauthorized(response, sentToken);
  return response;
}

/**
 * Construye el mensaje para el usuario a partir del cuerpo JSON de una respuesta fallida.
 * El backend responde `{ error: 'mensaje en español', details?: ... }`:
 *  - usa `error` (o `message`) cuando es texto; si no, el `fallbackMessage`;
 *  - añade `details` solo si es texto (se ignora si es un objeto, p. ej. un error de Prisma).
 *
 * @param {unknown} errorData cuerpo ya parseado (o `{}` si no era JSON)
 * @param {string} fallbackMessage
 * @returns {string}
 */
export function extractErrorMessage(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== 'object') return fallbackMessage;
  const baseMsg = asText(errorData.error) || asText(errorData.message) || fallbackMessage;
  const details = asText(errorData.details);
  if (details && details !== baseMsg) return `${baseMsg}: ${details}`;
  return baseMsg;
}

/**
 * Lanza un `Error` con el mensaje del backend (o `Error (<status>): <fallback>`) si la respuesta
 * no es satisfactoria.
 * @param {Response} response
 * @param {string} fallbackMessage texto genérico sin prefijo, p. ej. 'No se pudo crear el producto.'
 */
async function assertOk(response, fallbackMessage) {
  if (response.ok) return;
  const errorData = await response.json().catch(() => ({}));
  throw new Error(extractErrorMessage(errorData, `Error (${response.status}): ${fallbackMessage}`));
}

/**
 * Hace una petición y devuelve el JSON de la respuesta.
 *
 *  - Siempre envía `Accept: application/json`.
 *  - `body` JSON: se serializa y se añade `Content-Type: application/json`. `undefined` = sin cuerpo.
 *  - `body` `FormData`: se envía tal cual SIN `Content-Type` (el navegador añade el `boundary`).
 *  - Si falla, lanza `Error` con el texto del backend o `Error (<status>): <fallbackMessage>`.
 *  - `skipAuth: true` para endpoints públicos (el login): sin token y un 401 no cierra la sesión.
 *
 * @param {string} url
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string>, skipAuth?: boolean }} [options]
 * @param {string} [fallbackMessage] mensaje genérico en español (sin el prefijo "Error (N):")
 * @returns {Promise<any>}
 */
export async function requestJson(url, { method = 'GET', body, headers, skipAuth } = {}, fallbackMessage = 'No se pudo completar la operación.') {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const hasJsonBody = body !== undefined && !isForm;

  const response = await apiFetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined ? { body: hasJsonBody ? JSON.stringify(body) : body } : {}),
    ...(skipAuth ? { skipAuth: true } : {}),
  });

  await assertOk(response, fallbackMessage);
  return response.json();
}

/**
 * Como `requestJson`, pero devuelve el `Blob` de la respuesta (descarga de plantillas / reportes).
 * No envía `Accept: application/json` porque la respuesta no es JSON.
 * Lleva el token como cualquier otra petición: las descargas NUNCA deben ir por un enlace directo
 * (`<a href>`, `window.open`...) porque el navegador no puede mandar la cabecera `Authorization`.
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string, string> }} [options]
 * @param {string} [fallbackMessage]
 * @returns {Promise<Blob>}
 */
export async function requestBlob(url, { method = 'GET', headers } = {}, fallbackMessage = 'No se pudo descargar el archivo.') {
  const response = await apiFetch(url, { method, headers: { ...(headers || {}) } });
  await assertOk(response, fallbackMessage);
  return response.blob();
}
