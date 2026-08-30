/**
 * Pure JavaScript utilities for the Orders module.
 */

/**
 * Formats a numeric value as currency ($XX.XX).
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats ISO date string to localized Colombian date/time (e.g., "30 ago, 01:15 PM").
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
