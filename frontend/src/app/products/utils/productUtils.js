/**
 * Pure JavaScript utilities and formatters for the Products module.
 */

/**
 * Formats a numeric value as standard currency ($XX.XX).
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
 * Product Type labels and mappings.
 */
export const PRODUCT_TYPES = {
  PREPARED: {
    label: 'Preparado con Receta',
    shortLabel: 'Preparado',
    badgeClass: 'bg-amber-50 text-[#FF7A00] border-amber-200',
  },
  DIRECT_INVENTORY: {
    label: 'Venta Directa',
    shortLabel: 'Venta Directa',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-200',
  },
};

/**
 * Availability state descriptors.
 */
export const AVAILABILITY_STATUS = {
  AVAILABLE: {
    label: 'Disponible',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  UNAVAILABLE: {
    label: 'No Disponible',
    badgeClass: 'bg-rose-50 text-[#E63946] border-rose-200',
  },
};
