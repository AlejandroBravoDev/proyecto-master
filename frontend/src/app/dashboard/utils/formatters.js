/**
 * Utility functions for data formatting without React dependencies.
 */

/**
 * Formats a number as USD currency string.
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a decimal/percentage value into a user-friendly string.
 * @param {number} value
 * @returns {string}
 */
export function formatPercentage(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

/**
 * Formats integer count with commas.
 * @param {number} count
 * @returns {string}
 */
export function formatNumber(count) {
  return new Intl.NumberFormat('en-US').format(count);
}
