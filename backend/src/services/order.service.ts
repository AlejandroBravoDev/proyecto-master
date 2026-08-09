/**
 * ====================================================
 * SERVICIO DE COMANDAS Y PEDIDOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Procesa la creación de pedidos y efectúa el DESCUENTO AUTOMÁTICO
 * de stock de insumos en bodega según la receta dentro de una transacción.
 */

import prisma from '../prisma/client';

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
   * Registra una nueva comanda y descuenta el stock de insumos en una transacción atómica.
   * @param data Lista de productos solicitados con sus cantidades y notas opcionales
   */
  async createOrder(data: {
    items: Array<{ productId: number; quantity: number; unitPrice?: number; notes?: string }>;
    notes?: string;
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

    let total = 0;
    const orderDetailsData: any[] = [];

    // 2. Validar cada ítem del pedido, calcular subtotales y validar disponibilidad
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
      const subtotal = unitPrice * qty;
      total += subtotal;

      orderDetailsData.push({
        productId: prodId,
        quantity: qty,
        unitPrice,
        subtotal,
        notes: item.notes || null
      });
    }

    // 3. Generar el número correlativo de la comanda (ej: ORD-0001)
    const count = await prisma.order.count();
    const number = `ORD-${(count + 1).toString().padStart(4, '0')}`;

    // 4. Transacción ACID: Crear comanda y descontar insumos simultáneamente
    return prisma.$transaction(async (tx) => {
      // Crear registro de comanda
      const newOrder = await tx.order.create({
        data: {
          number,
          notes: data.notes,
          total,
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

      // Descontar inventario por cada ingrediente según la receta del producto
      for (const item of data.items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);
        const product = productMap.get(prodId);

        // Si el producto tiene receta, procesar deducción de cada ingrediente
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

      return newOrder;
    });
  }

  /**
   * Elimina una comanda por su ID.
   * @param id ID de la comanda
   */
  async deleteOrder(id: number) {
    return prisma.order.delete({ where: { id } });
  }
}

export const orderService = new OrderService();
