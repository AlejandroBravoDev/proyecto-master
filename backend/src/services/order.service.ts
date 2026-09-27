/**
 * ====================================================
 * SERVICIO DE COMANDAS Y PEDIDOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Procesa la creación de pedidos y efectúa de forma automática:
 * 1. Descuento de stock de insumos en bodega según receta.
 * 2. Registro inmediato de la Venta (Sale) cobrada.
 */

import prisma from '../prisma/client';
import { PaymentMethod } from '@prisma/client';

export class OrderService {
  /**
   * Obtiene la lista completa de comandas ordenadas por fecha reciente.
   */
  async getAllOrders() {
    return prisma.order.findMany({
      include: {
        orderDetails: {
          include: { product: true }
        },
        sale: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtiene una comanda por su ID con sus detalles y estado de facturación.
   * @param id ID de la comanda
   */
  async getOrderById(id: number) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        orderDetails: {
          include: { product: true }
        },
        sale: true
      }
    });
  }

  /**
   * Registra una nueva comanda, descuenta insumos y genera la VENTA (Sale) automáticamente.
   * @param data Lista de productos solicitados, forma de pago opcional, impuestos/descuentos y notas
   */
  async createOrder(data: {
    items: Array<{ productId: number; quantity: number; unitPrice?: number; notes?: string }>;
    notes?: string;
    paymentMethod?: PaymentMethod;
    tax?: number;
    discount?: number;
  }) {
    // 1. Obtener la información de los productos solicitados junto a sus recetas e insumos
    const productIds = data.items.map((item) => Number(item.productId));
    const products = await prisma.product.findMany({
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

    // 2. Validar cada ítem del pedido, calcular subtotales y estructurar líneas de venta
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

      const unitPrice = Number(item.unitPrice ?? product.salePrice);
      const itemSubtotal = unitPrice * qty;
      subtotal += itemSubtotal;

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

    const calculatedTax = Number(data.tax || 0);
    const calculatedDiscount = Number(data.discount || 0);
    const totalFinal = subtotal + calculatedTax - calculatedDiscount;

    // 3. Transacción ACID: Generar correlativos únicos, crear comanda, factura (Sale) y descontar insumos
    return prisma.$transaction(async (tx) => {
      // A. Generación segura y libre de colisiones de orderNumber (ORD-XXXX)
      const lastOrder = await tx.order.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, number: true }
      });

      let nextOrderSeq = (lastOrder?.id ?? 0) + 1;
      if (lastOrder?.number) {
        const match = lastOrder.number.match(/(\d+)$/);
        if (match) {
          const lastNum = parseInt(match[1], 10);
          if (!isNaN(lastNum)) {
            nextOrderSeq = Math.max(nextOrderSeq, lastNum + 1);
          }
        }
      }

      let orderNumber = `ORD-${nextOrderSeq.toString().padStart(4, '0')}`;
      while (await tx.order.findUnique({ where: { number: orderNumber } })) {
        nextOrderSeq++;
        orderNumber = `ORD-${nextOrderSeq.toString().padStart(4, '0')}`;
      }

      // B. Generación segura y libre de colisiones de invoiceNumber (INV-YYYY-XXXX)
      const currentYear = new Date().getFullYear();
      const lastSale = await tx.sale.findFirst({
        orderBy: { id: 'desc' },
        select: { id: true, invoiceNumber: true }
      });

      let nextSaleSeq = (lastSale?.id ?? 0) + 1;
      if (lastSale?.invoiceNumber) {
        const match = lastSale.invoiceNumber.match(/(\d+)$/);
        if (match) {
          const lastNum = parseInt(match[1], 10);
          if (!isNaN(lastNum)) {
            nextSaleSeq = Math.max(nextSaleSeq, lastNum + 1);
          }
        }
      }

      let invoiceNumber = `INV-${currentYear}-${nextSaleSeq.toString().padStart(4, '0')}`;
      while (await tx.sale.findUnique({ where: { invoiceNumber } })) {
        nextSaleSeq++;
        invoiceNumber = `INV-${currentYear}-${nextSaleSeq.toString().padStart(4, '0')}`;
      }

      // C. Crear registro de comanda
      const newOrder = await tx.order.create({
        data: {
          number: orderNumber,
          notes: data.notes,
          total: subtotal,
          orderDetails: {
            create: orderDetailsData
          }
        },
        include: {
          orderDetails: {
            include: { product: true }
          }
        }
      });

      // D. Crear registro de VENTA/Factura vinculada a la comanda
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          orderId: newOrder.id,
          subtotal,
          tax: calculatedTax,
          discount: calculatedDiscount,
          total: totalFinal,
          paymentMethod: data.paymentMethod || 'CASH',
          saleDetails: {
            create: saleDetailsData
          }
        }
      });

      // C. Descontar inventario por cada ingrediente según la receta del producto
      for (const item of data.items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);
        const product = productMap.get(prodId);

        if (product && product.recipe && product.recipe.recipeDetails) {
          for (const detail of product.recipe.recipeDetails) {
            const ingredientToDeduct = detail.quantity * qty;
            const ingredient = detail.ingredient;

            const previousStock = ingredient.currentStock;
            const newStock = previousStock - ingredientToDeduct;

            // Actualizar stock del insumo
            await tx.ingredient.update({
              where: { id: ingredient.id },
              data: { currentStock: newStock }
            });

            // Registrar movimiento de salida en el historial (Kardex)
            await tx.inventoryMovement.create({
              data: {
                ingredientId: ingredient.id,
                type: 'OUT',
                reason: 'SALE',
                quantity: ingredientToDeduct,
                previousStock,
                newStock,
                reference: `Order #${newOrder.number}`
              }
            });
          }
        }
      }

      return {
        ...newOrder,
        sale: newSale
      };
    });
  }

  /**
   * Elimina una comanda por su ID.
   * @param id ID de la comanda
   */
  async deleteOrder(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.sale.deleteMany({ where: { orderId: id } });
      return tx.order.delete({ where: { id } });
    });
  }
}

export const orderService = new OrderService();
