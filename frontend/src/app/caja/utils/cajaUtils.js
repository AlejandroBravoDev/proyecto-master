/**
 * Pure JavaScript utilities and formatters for the Caja module.
 */

/**
 * Standard Cash Denominations (Coins & Bills) for Opening Float and Closing counts.
 */
export const CASH_DENOMINATIONS = [
  { value: 0.05, label: '$0.05', type: 'COIN' },
  { value: 0.10, label: '$0.10', type: 'COIN' },
  { value: 0.25, label: '$0.25', type: 'COIN' },
  { value: 0.50, label: '$0.50', type: 'COIN' },
  { value: 1.00, label: '$1.00', type: 'COIN' },
  { value: 2.00, label: '$2.00', type: 'BILL' },
  { value: 5.00, label: '$5.00', type: 'BILL' },
  { value: 10.00, label: '$10.00', type: 'BILL' },
  { value: 20.00, label: '$20.00', type: 'BILL' },
  { value: 50.00, label: '$50.00', type: 'BILL' },
  { value: 100.00, label: '$100.00', type: 'BILL' },
];

/**
 * Calculates total cash sum from a denominations count map.
 * @param {Record<string, number>} countsMap e.g. { "0.10": 20, "1": 15 }
 * @returns {number}
 */
export function calculateDenominationsTotal(countsMap = {}) {
  let sum = 0;
  for (const [key, count] of Object.entries(countsMap)) {
    const val = parseFloat(key);
    const qty = parseInt(String(count || 0), 10);
    if (!isNaN(val) && val > 0 && qty > 0) {
      sum += val * qty;
    }
  }
  return Number(sum.toFixed(2));
}

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
 * Formats ISO date string to localized Colombian date/time (e.g., "30 ago 2026, 02:15 PM").
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
