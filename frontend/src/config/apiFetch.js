/**
 * Capa HTTP compartida del frontend.
 *
 * TODOS los services (`src/app/<feature>/services/*Service.js`) llaman al backend a través de este
 * módulo y nunca con `fetch` directo. Así hay un único sitio donde:
 *  - un fallo de red ("Failed to fetch") se convierte en un mensaje en español;
 *  - se interpreta el cuerpo de error del backend (`{ error, details? }`);
 *  - se inyectan cabeceras comunes (ver `getAuthHeaders`).
 *
 * Funciones exportadas:
 *  - `getAuthHeaders()`      punto de extensión para la cabecera `Authorization` (hoy devuelve `{}`).
 *  - `apiFetch(url, opts)`   `fetch` + cabeceras comunes + error de red en español.
 *  - `extractErrorMessage()` texto de error legible a partir del cuerpo de una respuesta fallida.
 *  - `requestJson()`         petición JSON (o multipart) que valida `response.ok` y devuelve el JSON.
 *  - `requestBlob()`         igual, pero devuelve el `Blob` (descarga de Excel).
 */

/** Mensaje que ve el usuario cuando el servidor no responde (backend caído, sin red, CORS). */
export const NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Verifica tu conexión o que el backend esté en ejecución.';

/**
 * PUNTO DE EXTENSIÓN para la autenticación (fase S1).
 *
 * Devuelve las cabeceras que `apiFetch` añade a CADA petición. Hoy el backend no autentica, así
 * que devuelve un objeto vacío. Cuando exista sesión con JWT, este es el único lugar donde hay
 * que leer el token y devolver `{ Authorization: `Bearer ${token}` }`; ningún service cambia.
 *
 * @returns {Record<string, string>}
 */
export function getAuthHeaders() {
  return {};
}

/**
 * `fetch` que añade `getAuthHeaders()` y traduce el rechazo de red a un `Error` en español.
 * Las cabeceras que pase el llamador tienen prioridad sobre las comunes.
 * Devuelve la `Response` tal cual (no valida `ok`: eso lo hacen `requestJson` / `requestBlob`).
 *
 * `fetch` rechaza con `TypeError: Failed to fetch` (en inglés) cuando no hay respuesta del
 * servidor; las respuestas HTTP 4xx/5xx NO rechazan.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}) {
  const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  try {
    return await fetch(url, { ...options, headers });
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

/** Devuelve el texto si es un string no vacío; si no, `''`. */
function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
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
 *
 * @param {string} url
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string> }} [options]
 * @param {string} [fallbackMessage] mensaje genérico en español (sin el prefijo "Error (N):")
 * @returns {Promise<any>}
 */
export async function requestJson(url, { method = 'GET', body, headers } = {}, fallbackMessage = 'No se pudo completar la operación.') {
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
  });

  await assertOk(response, fallbackMessage);
  return response.json();
}

/**
 * Como `requestJson`, pero devuelve el `Blob` de la respuesta (descarga de plantillas / reportes).
 * No envía `Accept: application/json` porque la respuesta no es JSON.
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
