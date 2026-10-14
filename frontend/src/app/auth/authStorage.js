/**
 * Almacenamiento de la sesión (token JWT + usuario) en `sessionStorage`.
 *
 * Es un módulo SIN dependencias de React a propósito: lo usan tanto `AuthContext` como la capa HTTP
 * (`config/apiFetch.js`), y así no hay ciclos de importación entre ambos.
 *
 * `sessionStorage` puede fallar (modo privado, almacenamiento bloqueado, cuota): todas las funciones
 * están protegidas con try/catch y nunca lanzan. Si no se puede ESCRIBIR el token, se conserva en
 * memoria mientras la página siga abierta para que el inicio de sesión funcione igualmente (al
 * recargar la página, sin almacenamiento, la sesión se pierde: es lo esperable).
 *
 * Funciones exportadas:
 *  - `getStoredToken()` / `setStoredToken(token)` / `clearStoredToken()`
 *  - `getStoredUser()`  / `setStoredUser(user)`   / `clearStoredUser()`
 *  - `clearStoredSession()` borra token y usuario.
 */

/** Clave del token JWT en `sessionStorage`. */
export const AUTH_TOKEN_KEY = 'masterfood_auth_token';
/** Clave del usuario (id, nombre, rol...) en `sessionStorage`. */
export const AUTH_USER_KEY = 'masterfood_auth_user';

/** Copia en memoria del token, solo se usa cuando `sessionStorage` no permite escribir. */
let memoryToken = null;

/**
 * Token JWT de la sesión actual, o `null` si no hay.
 * @returns {string|null}
 */
export function getStoredToken() {
  try {
    const stored = sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (stored) return stored;
  } catch {
    /* almacenamiento no disponible: se usa la copia en memoria */
  }
  return memoryToken;
}

/**
 * Guarda el token de la sesión.
 * @param {string} token
 */
export function setStoredToken(token) {
  memoryToken = null;
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    memoryToken = token;
  }
}

/** Borra el token (de `sessionStorage` y de la copia en memoria). */
export function clearStoredToken() {
  memoryToken = null;
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* nada que borrar si el almacenamiento no está disponible */
  }
}

/**
 * Usuario guardado, o `null` si no hay o el JSON está corrupto.
 * @returns {object|null}
 */
export function getStoredUser() {
  try {
    const stored = sessionStorage.getItem(AUTH_USER_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el usuario de la sesión.
 * @param {object} user
 */
export function setStoredUser(user) {
  try {
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    /* sin almacenamiento: el usuario vive solo en el estado de React */
  }
}

/** Borra el usuario guardado. */
export function clearStoredUser() {
  try {
    sessionStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* nada que borrar si el almacenamiento no está disponible */
  }
}

/** Borra token y usuario: cierra la sesión guardada. */
export function clearStoredSession() {
  clearStoredToken();
  clearStoredUser();
}
