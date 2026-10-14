/**
 * Pure JavaScript utilities for the Orders module.
 */

// Moneda: formateador único compartido (ver common/formatCurrency.js).
export { formatCurrency } from '../../common/formatCurrency';

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
