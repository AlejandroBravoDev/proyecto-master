/**
 * ====================================================
 * VALIDACIÓN DE COMANDAS Y VENTAS
 * ====================================================
 * Reglas de entrada compartidas por order.service y sale.service. Lanzan
 * `new Error('CODIGO')` (convención de errores de dominio del proyecto) y el
 * controller los traduce a 400.
 */

import { PaymentMethod } from '@prisma/client';

const PAYMENT_METHODS: string[] = Object.values(PaymentMethod);

/** Redondeo de cantidades de stock a 6 decimales (ignora el ruido de coma flotante). */
export const roundQuantity = (value: number): number => Number(value.toFixed(6));

/**
 * Forma de pago: vacía = efectivo (CASH). Cualquier valor fuera del enum
 * lanza `INVALID_PAYMENT_METHOD`.
 */
export function normalizePaymentMethod(value: unknown): PaymentMethod {
  if (value === undefined || value === null || value === '') return 'CASH';
  if (typeof value !== 'string' || !PAYMENT_METHODS.includes(value)) {
    throw new Error('INVALID_PAYMENT_METHOD');
  }
  return value as PaymentMethod;
}

/** Impuesto o descuento: vacío = 0. Un valor no numérico o negativo lanza `INVALID_AMOUNT`. */
export function normalizeAmount(value: unknown): number {
  if (value === undefined || value === null || value === '' || value === false) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('INVALID_AMOUNT');
  }
  return amount;
}

/**
 * Renglones de una comanda o venta directa: cada uno con `productId` entero positivo y
 * `quantity` entero mayor a 0 (una cantidad negativa sumaría stock). Lanza `INVALID_ITEM`.
 */
export function assertValidItems(items: unknown): void {
  if (!Array.isArray(items)) {
    throw new Error('INVALID_ITEM');
  }
  for (const raw of items) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('INVALID_ITEM');
    }
  }
}
