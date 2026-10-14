/**
 * Formateador de moneda ÚNICO de la app. Los `utils` de cada feature lo reexportan, así que todas
 * las pantallas muestran los importes igual (p. ej. "US$ 1.299,50").
 *
 * Antes había copias con dos locales distintos (`es-CO` y `en-US`); se unificó en `es-CO` por ser
 * el de caja, productos y comandas.
 */

const CURRENCY_FORMAT = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un importe como moneda. Un valor vacío o no numérico (`null`, `undefined`, `''`,
 * `NaN`, texto) se muestra como cero, con el mismo formato que el resto de importes.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const amount = Number(value);
  return CURRENCY_FORMAT.format(Number.isFinite(amount) ? amount : 0);
}
