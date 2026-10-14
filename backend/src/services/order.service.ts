/**
 * ====================================================
 * SERVICIO DE COMANDAS Y PEDIDOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Procesa la creación de pedidos y efectúa de forma automática:
 * 1. Validación de sesión de caja activa (caja abierta).
 * 2. Validación de stock suficiente y descuento de insumos en bodega según receta
 *    (sin stock suficiente no se crea nada).
 * 3. Registro inmediato de la Venta (Sale) cobrada.
 * 4. Filtrado por turno actual (active) o histórico por fecha/sesión.
 * 5. Al eliminar una comanda se devuelve el stock con movimientos compensatorios en el Kardex.
 */

import prisma from '../prisma/client';
import { PaymentMethod } from '@prisma/client';
import { nextInvoiceNumber, nextOrderNumber } from '../utils/sequence.utils';
import { assertValidItems, normalizeAmount, normalizePaymentMethod, roundQuantity } from '../utils/sale.utils';

/** Prefijo del error de stock insuficiente: `INSUFFICIENT_STOCK:<JSON de StockShortage[]>`. */
export const INSUFFICIENT_STOCK_PREFIX = 'INSUFFICIENT_STOCK:';

/** Insumo que no alcanza para completar una comanda. */
export interface StockShortage {
  ingredientId: number;
  name: string;
  measurementUnit: string;
  /** Cantidad total que necesita la comanda */
  needed: number;
  /** Stock disponible en bodega */
  available: number;
}

/** Tolerancia para comparar cantidades de punto flotante. */
const STOCK_EPSILON = 1e-9;

/** Lee los faltantes de un error `INSUFFICIENT_STOCK:<json>` (arreglo vacío si no se puede leer). */
export function parseInsufficientStock(message: string): StockShortage[] {
  try {
    const parsed = JSON.parse(message.slice(INSUFFICIENT_STOCK_PREFIX.length));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class OrderService {
  /**
   * Obtiene la lista de comandas según los filtros especificados.
   * Por defecto (sin filtros o scope=active) retorna solo las comandas activas del turno actual.
   * @param filters Opciones de filtrado: scope ('active' | 'all'), date ('YYYY-MM-DD'), cashSessionId
   */
  async getAllOrders(filters?: { scope?: string; date?: string; cashSessionId?: number }) {
    const whereClause: any = {};

    if (filters?.scope === 'all') {
      // Retorna todas las comandas históricas
    } else if (filters?.date) {
      // Filtrar por fecha específica (inicio a fin del día)
      const dateStr = filters.date.trim();
      const startOfDay = new Date(`${dateStr}T00:00:00.000`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);
      whereClause.date = {
        gte: startOfDay,
        lte: endOfDay
      };
    } else if (filters?.cashSessionId) {
      // Filtrar por sesión de caja específica
      whereClause.cashSessionId = Number(filters.cashSessionId);
    } else {
      // Por defecto: solo comandas activas del turno actual
      whereClause.active = true;
    }

    return prisma.order.findMany({
      where: whereClause,
      include: {
        orderDetails: {
          include: { product: true }
        },
        sale: true,
        cashSession: {
          select: {
            id: true,
            sessionNumber: true,
            openedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtiene una comanda por su ID con sus detalles, factura y sesión de caja.
   * @param id ID de la comanda
   */
  async getOrderById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        orderDetails: {
          include: { product: true }
        },
        sale: true,
        cashSession: {
          select: {
            id: true,
            sessionNumber: true,
            openedAt: true
          }
        }
      }
    });
  }

  /**
   * Registra una nueva comanda, valida caja abierta y stock suficiente, descuenta insumos
   * y genera la VENTA (Sale) automáticamente, todo en una única transacción.
   * Códigos de error: CAJA_CERRADA, PRODUCT_NOT_FOUND:<id>, PRODUCT_UNAVAILABLE:<nombre>,
   * INSUFFICIENT_STOCK:<json>, INVALID_ITEM, INVALID_AMOUNT, INVALID_PAYMENT_METHOD.
   * Los productos DIRECT_INVENTORY no tienen receta y no descuentan insumos.
   * @param data Lista de productos solicitados, forma de pago opcional, impuestos/descuentos y notas
   */
  async createOrder(data: {
    items: Array<{ productId: number; quantity: number; unitPrice?: number | string; notes?: string }>;
    notes?: string;
    paymentMethod?: PaymentMethod;
    tax?: number;
    discount?: number;
  }) {
    // 0. Validar la entrada antes de abrir la transacción
    assertValidItems(data.items);
    const paymentMethod = normalizePaymentMethod(data.paymentMethod);
    const calculatedTax = Number(normalizeAmount(data.tax).toFixed(2));
    const calculatedDiscount = Number(normalizeAmount(data.discount).toFixed(2));

    return prisma.$transaction(async (tx) => {
      // 1. Validación obligatoria de Caja Abierta
      const activeCashSession = await tx.cashSession.findFirst({
        where: { status: 'OPEN' }
      });

      if (!activeCashSession) {
        throw new Error('CAJA_CERRADA');
      }

      // 2. Obtener la información de los productos solicitados junto a sus recetas e insumos
      const productIds = data.items.map((item) => Number(item.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: {
          recipe: {
            include: {
              recipeDetails: {
                include: { ingredient: true }
              }
            }
          }
        }
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const orderDetailsData: any[] = [];
      const saleDetailsData: any[] = [];

      // 3. Validar cada ítem del pedido, calcular subtotales y estructurar líneas de venta
      for (const item of data.items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);
        const product = productMap.get(prodId);

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${prodId}`);
        }

        if (!product.available) {
          throw new Error(`PRODUCT_UNAVAILABLE:${product.name}`);
        }

        const hasCustomPrice = item.unitPrice !== undefined && item.unitPrice !== null && String(item.unitPrice).trim() !== '';
        const parsedCustomPrice = hasCustomPrice ? Number(item.unitPrice) : NaN;
        const unitPrice = !isNaN(parsedCustomPrice) && parsedCustomPrice >= 0
          ? Number(parsedCustomPrice.toFixed(2))
          : Number(product.salePrice);

        const itemSubtotal = Number((unitPrice * qty).toFixed(2));
        subtotal = Number((subtotal + itemSubtotal).toFixed(2));

        orderDetailsData.push({
          productId: prodId,
          quantity: qty,
          unitPrice,
          subtotal: itemSubtotal,
          notes: item.notes || null
        });

        saleDetailsData.push({
          productId: prodId,
          quantity: qty,
          unitPrice,
          subtotal: itemSubtotal
        });
      }

      const totalFinal = Number((subtotal + calculatedTax - calculatedDiscount).toFixed(2));

      // 4. Validar stock ANTES de crear o descontar nada: se suma lo que necesita toda la comanda
      //    por insumo (un mismo insumo puede aparecer en varias líneas) y se compara con el
      //    stock leído ahora, dentro de la transacción.
      const needed = new Map<number, number>();
      for (const item of data.items) {
        const qty = Number(item.quantity);
        const recipeDetails = productMap.get(Number(item.productId))?.recipe?.recipeDetails ?? [];
        for (const detail of recipeDetails) {
          needed.set(detail.ingredientId, (needed.get(detail.ingredientId) ?? 0) + detail.quantity * qty);
        }
      }

      const freshIngredients = needed.size > 0
        ? await tx.ingredient.findMany({ where: { id: { in: [...needed.keys()] } } })
        : [];
      const currentStock = new Map(freshIngredients.map((ing) => [ing.id, ing.currentStock]));

      const shortages: StockShortage[] = [];
      for (const ingredient of freshIngredients) {
        const totalNeeded = needed.get(ingredient.id) ?? 0;
        if (totalNeeded - ingredient.currentStock > STOCK_EPSILON) {
          shortages.push({
            ingredientId: ingredient.id,
            name: ingredient.name,
            measurementUnit: ingredient.measurementUnit,
            needed: roundQuantity(totalNeeded),
            available: ingredient.currentStock
          });
        }
      }
      if (shortages.length > 0) {
        throw new Error(`${INSUFFICIENT_STOCK_PREFIX}${JSON.stringify(shortages)}`);
      }

      // 5. Generar correlativos únicos: orderNumber (ORD-XXXX) e invoiceNumber (INV-YYYY-XXXX)
      const orderNumber = await nextOrderNumber(tx);
      const invoiceNumber = await nextInvoiceNumber(tx);

      // 6. Crear registro de comanda vinculada a la sesión de caja activa
      const newOrder = await tx.order.create({
        data: {
          number: orderNumber,
          notes: data.notes,
          total: subtotal,
          active: true,
          cashSessionId: activeCashSession.id,
          orderDetails: {
            create: orderDetailsData
          }
        },
        include: {
          orderDetails: {
            include: { product: true }
          },
          cashSession: {
            select: {
              id: true,
              sessionNumber: true,
              openedAt: true
            }
          }
        }
      });

      // 7. Crear registro de VENTA/Factura vinculada a la comanda
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          orderId: newOrder.id,
          subtotal,
          tax: calculatedTax,
          discount: calculatedDiscount,
          total: totalFinal,
          paymentMethod,
          saleDetails: {
            create: saleDetailsData
          }
        }
      });

      // 8. Descontar inventario por cada ingrediente según la receta del producto, línea por línea
      //    (el stock vigente se va actualizando para que líneas con el mismo insumo cuadren).
      for (const item of data.items) {
        const qty = Number(item.quantity);
        const product = productMap.get(Number(item.productId));

        for (const detail of product?.recipe?.recipeDetails ?? []) {
          const ingredientId = detail.ingredientId;
          const ingredientToDeduct = roundQuantity(detail.quantity * qty);

          const previousStock = currentStock.get(ingredientId) ?? 0;
          const newStock = Math.max(0, roundQuantity(previousStock - ingredientToDeduct));

          // Actualizar stock del insumo
          await tx.ingredient.update({
            where: { id: ingredientId },
            data: { currentStock: newStock }
          });

          // Registrar movimiento de salida en el historial (Kardex)
          await tx.inventoryMovement.create({
            data: {
              ingredientId,
              type: 'OUT',
              reason: 'SALE',
              quantity: ingredientToDeduct,
              previousStock,
              newStock,
              reference: `Order #${newOrder.number}`
            }
          });

          currentStock.set(ingredientId, newStock);
        }
      }

      return {
        ...newOrder,
        sale: newSale
      };
    });
  }

  /**
   * ID de la sesión de caja abierta ahora mismo (`null` si la caja está cerrada).
   * Sirve para decidir qué comandas puede consultar un trabajador (solo las del turno actual).
   */
  async getOpenCashSessionId(): Promise<number | null> {
    const session = await prisma.cashSession.findFirst({
      where: { status: 'OPEN' },
      select: { id: true }
    });
    return session?.id ?? null;
  }

  /**
   * Elimina una comanda por su ID, junto con su venta, y DEVUELVE el stock descontado:
   * por cada insumo consumido por la comanda registra un movimiento IN compensatorio
   * (MANUAL_ADJUSTMENT, referencia "Anulación Order #ORD-xxxx") en la misma transacción.
   * Se devuelve lo que realmente salió del Kardex (movimientos SALE de la comanda), no lo que
   * diga la receta hoy, porque la receta pudo cambiar después de la venta.
   * Lanza `ORDER_NOT_FOUND` si la comanda no existe y, con `onlyCurrentShift`, `ORDER_NOT_IN_CURRENT_SHIFT`
   * si la comanda ya no es del turno actual (se comprueba dentro de la transacción, sin carrera con el cierre de caja).
   * @param id ID de la comanda
   * @param options.onlyCurrentShift Solo permite eliminar comandas activas (turno actual): lo exige el rol WORKER
   */
  async deleteOrder(id: number, options: { onlyCurrentShift?: boolean } = {}) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, number: true, createdAt: true, active: true }
      });
      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }
      if (options.onlyCurrentShift && !order.active) {
        throw new Error('ORDER_NOT_IN_CURRENT_SHIFT');
      }

      // Los números de comanda se pueden reutilizar tras borrar la última: se limita a los
      // movimientos creados desde que nació esta comanda para no devolver stock de otra anterior.
      const reference = `Order #${order.number}`;
      const sold = await tx.inventoryMovement.findMany({
        where: { reference, type: 'OUT', reason: 'SALE', date: { gte: order.createdAt } },
        orderBy: { id: 'asc' }
      });

      const toReturn = new Map<number, number>();
      for (const movement of sold) {
        toReturn.set(movement.ingredientId, (toReturn.get(movement.ingredientId) ?? 0) + movement.quantity);
      }

      for (const [ingredientId, quantity] of toReturn) {
        const ingredient = await tx.ingredient.findUnique({ where: { id: ingredientId } });
        if (!ingredient) continue; // el insumo se eliminó después de la venta

        const returned = roundQuantity(quantity);
        const previousStock = ingredient.currentStock;
        const newStock = roundQuantity(previousStock + returned);

        await tx.ingredient.update({
          where: { id: ingredientId },
          data: { currentStock: newStock }
        });

        await tx.inventoryMovement.create({
          data: {
            ingredientId,
            type: 'IN',
            reason: 'MANUAL_ADJUSTMENT',
            quantity: returned,
            previousStock,
            newStock,
            reference: `Anulación ${reference}`
          }
        });
      }

      await tx.sale.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }
}

export const orderService = new OrderService();
