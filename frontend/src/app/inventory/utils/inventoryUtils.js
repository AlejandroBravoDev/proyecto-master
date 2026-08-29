/**
 * Inventory Utility Functions
 * Pure JavaScript helpers for formatting, unit labeling, and stock calculations.
 */

export const MEASUREMENT_UNITS = [
  { value: 'unidad', label: 'Unidad (und)' },
  { value: 'kg', label: 'Kilogramo (kg)' },
  { value: 'g', label: 'Gramo (g)' },
  { value: 'litro', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'porcion', label: 'Porción' },
];

export const ADJUSTMENT_REASONS = [
  { value: 'PURCHASE', label: 'Entrada por Compra (+)', type: 'IN' },
  { value: 'WASTE', label: 'Salida por Merma / Desperdicio (-)', type: 'OUT' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Ajuste Manual de Inventario', type: 'ADJUSTMENT' },
];

export const REASON_LABELS = {
  PURCHASE: 'Compra',
  SALE: 'Venta (Receta)',
  WASTE: 'Merma / Desperdicio',
  MANUAL_ADJUSTMENT: 'Ajuste Manual',
};

/**
 * Formats a numeric value to USD currency string.
 * @param {number} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats quantity with appropriate decimals.
 * @param {number} value
 * @param {string} unit
 * @returns {string}
 */
export function formatQuantity(value, unit = '') {
  const num = Number(value) || 0;
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Returns stock status classification.
 * @param {number} currentStock
 * @param {number} minimumStock
 * @returns {{status: 'OUT_OF_STOCK'|'LOW_STOCK'|'OPTIMAL', label: string, badgeClass: string, isCritical: boolean}}
 */
export function getStockStatus(currentStock, minimumStock) {
  const current = Number(currentStock) || 0;
  const min = Number(minimumStock) || 0;

  if (current <= 0) {
    return {
      status: 'OUT_OF_STOCK',
      label: 'Agotado',
      badgeClass: 'bg-rose-50 text-[#E63946] border-rose-200',
      isCritical: true,
    };
  }

  if (current <= min) {
    return {
      status: 'LOW_STOCK',
      label: 'Stock Bajo',
      badgeClass: 'bg-amber-50 text-[#FF7A00] border-amber-200',
      isCritical: true,
    };
  }

  return {
    status: 'OPTIMAL',
    label: 'Óptimo',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    isCritical: false,
  };
}
