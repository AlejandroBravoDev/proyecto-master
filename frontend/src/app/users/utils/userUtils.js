/**
 * Pure JavaScript utility helpers for Users module.
 */

/**
 * Validates strictly that password has exactly 6 alphanumeric characters.
 * @param {string} password
 * @returns {boolean}
 */
export function isValidPassword6(password) {
  if (typeof password !== 'string') return false;
  return /^[a-zA-Z0-9]{6}$/.test(password);
}

/**
 * Returns formatted role name in Spanish.
 * @param {string} role
 * @returns {string}
 */
export function formatRole(role) {
  return role === 'ADMIN' ? 'Administrador' : 'Trabajador';
}

/**
 * Formats ISO date to readable string (e.g. "27 sep 2026").
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats ISO date to YYYY-MM-DD for HTML <input type="date"> value.
 * @param {string|Date} [dateStr]
 * @returns {string}
 */
export function formatDateForInput(dateStr) {
  if (!dateStr) {
    return new Date().toISOString().split('T')[0];
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
}
