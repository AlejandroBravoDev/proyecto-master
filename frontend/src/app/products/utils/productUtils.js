/**
 * Pure JavaScript utilities and formatters for the Products module.
 */

// Moneda: formateador único compartido (ver common/formatCurrency.js).
export { formatCurrency } from '../../common/formatCurrency';

/**
 * Converts the recipe rows of the product form into the payload the backend expects.
 * @param {Array<{ingredientId: number|string, quantity: number|string, measurementUnit?: string}>} rows
 * @returns {Array<{ingredientId: number, quantity: number, measurementUnit: string}>}
 */
export function buildRecipeIngredients(rows = []) {
  return rows.map((item) => ({
    ingredientId: Number(item.ingredientId),
    quantity: Number(item.quantity),
    measurementUnit: String(item.measurementUnit || 'unidad'),
  }));
}

/**
 * True when a recipe row has no ingredient selected or a quantity that is not greater than 0.
 * @param {{ingredientId: number|string, quantity: number|string}} item
 * @returns {boolean}
 */
export function isInvalidRecipeRow(item) {
  return !item.ingredientId || !(Number(item.quantity) > 0);
}

/**
 * True when two recipe row lists describe the same recipe (same ingredients, quantities and units),
 * regardless of the order of the rows.
 * @param {Array} rowsA
 * @param {Array} rowsB
 * @returns {boolean}
 */
export function isSameRecipe(rowsA = [], rowsB = []) {
  const normalize = (rows) =>
    buildRecipeIngredients(rows).sort((a, b) => a.ingredientId - b.ingredientId || a.quantity - b.quantity);
  return JSON.stringify(normalize(rowsA)) === JSON.stringify(normalize(rowsB));
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
