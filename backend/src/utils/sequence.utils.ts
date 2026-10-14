/**
 * ====================================================
 * GENERADOR DE CÓDIGOS CORRELATIVOS
 * ====================================================
 * Genera los códigos ORD-0001, INV-2026-0001 y CAJA-2026-0001 sin colisiones,
 * incluso si hay registros eliminados o códigos heredados. Deben invocarse DENTRO
 * de la transacción que crea el documento (reciben el cliente `tx`); el `@unique`
 * del campo sigue siendo la última defensa (P2002).
 *
 * Algoritmo: seq = max(últimoId + 1, últimoSufijoNumérico + 1), relleno a 4 dígitos
 * y, mientras el código exista, seq++.
 */

import type { Prisma } from '@prisma/client';

/** Cliente de Prisma dentro de una transacción (`prisma` también cumple este tipo). */
export type DbClient = Prisma.TransactionClient;

export interface SequenceOptions {
  /** Prefijo fijo, p. ej. "ORD-" o "INV-2026-" */
  prefix: string;
  /** Devuelve el último registro (por id) con su código, o null si no hay registros */
  getLast: () => Promise<{ id: number; code: string | null } | null>;
  /** Indica si un código ya está en uso */
  exists: (code: string) => Promise<boolean>;
  /** Cantidad de dígitos del correlativo (por defecto 4) */
  pad?: number;
}

/** Algoritmo genérico de correlativos (ver cabecera del archivo). */
export async function nextSequentialCode({
  prefix,
  getLast,
  exists,
  pad = 4
}: SequenceOptions): Promise<string> {
  const last = await getLast();

  let seq = (last?.id ?? 0) + 1;
  const match = last?.code?.match(/(\d+)$/);
  if (match) {
    const lastNum = parseInt(match[1], 10);
    if (!isNaN(lastNum)) {
      seq = Math.max(seq, lastNum + 1);
    }
  }

  let code = `${prefix}${String(seq).padStart(pad, '0')}`;
  while (await exists(code)) {
    seq++;
    code = `${prefix}${String(seq).padStart(pad, '0')}`;
  }

  return code;
}

/** Siguiente número de comanda: ORD-0001 */
export function nextOrderNumber(db: DbClient): Promise<string> {
  return nextSequentialCode({
    prefix: 'ORD-',
    getLast: async () => {
      const last = await db.order.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, number: true }
      });
      return last ? { id: last.id, code: last.number } : null;
    },
    exists: async (code) =>
      (await db.order.findUnique({ where: { number: code }, select: { id: true } })) !== null
  });
}

/** Siguiente número de factura: INV-2026-0001 */
export function nextInvoiceNumber(db: DbClient): Promise<string> {
  return nextSequentialCode({
    prefix: `INV-${new Date().getFullYear()}-`,
    getLast: async () => {
      const last = await db.sale.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, invoiceNumber: true }
      });
      return last ? { id: last.id, code: last.invoiceNumber } : null;
    },
    exists: async (code) =>
      (await db.sale.findUnique({ where: { invoiceNumber: code }, select: { id: true } })) !== null
  });
}

/** Siguiente número de sesión de caja: CAJA-2026-0001 */
export function nextCashSessionNumber(db: DbClient): Promise<string> {
  return nextSequentialCode({
    prefix: `CAJA-${new Date().getFullYear()}-`,
    getLast: async () => {
      const last = await db.cashSession.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, sessionNumber: true }
      });
      return last ? { id: last.id, code: last.sessionNumber } : null;
    },
    exists: async (code) =>
      (await db.cashSession.findUnique({ where: { sessionNumber: code }, select: { id: true } })) !== null
  });
}
