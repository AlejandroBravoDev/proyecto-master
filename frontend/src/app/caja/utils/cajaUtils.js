/**
 * Pure JavaScript utilities and formatters for the Caja module.
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

/**
 * Payment Methods Metadata
 */
export const PAYMENT_METHODS = {
  CASH: {
    id: 'CASH',
    label: 'Efectivo',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  CARD: {
    id: 'CARD',
    label: 'Tarjeta Débito / Crédito',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  TRANSFER: {
    id: 'TRANSFER',
    label: 'Transferencia Bancaria',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-500',
  },
  MIXED: {
    id: 'MIXED',
    label: 'Pago Combinado / Mixto',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
};
