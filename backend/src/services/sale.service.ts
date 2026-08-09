/**
 * ====================================================
 * SERVICIO DE VENTAS Y FACTURACIÓN (MODEL/SERVICE LAYER)
 * ====================================================
 * Procesa la cobranza, emisión de comprobantes/facturas
 * y cálculo de impuestos y descuentos aplicados.
 */

import prisma from '../prisma/client';
import { PaymentMethod } from '@prisma/client';

export class SaleService {
  /**
   * Obtiene la lista completa de ventas ordenadas por fecha reciente.
   */
  async getAllSales() {
    return prisma.sale.findMany({
      include: {
        order: true,
        saleDetails: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtiene el detalle de una factura por su ID.
   * @param id ID único de la venta
   */
  async getSaleById(id: number) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            orderDetails: {
              include: { product: true }
            }
          }
        },
        saleDetails: {
          include: { product: true }
        }
      }
    });
  }

  /**
   * Emite una factura a partir de una comanda existente o venta directa.
   * @param data ID de la comanda u orden, forma de pago, impuestos y descuentos
   */
  async createSale(data: {
    orderId?: number;
    paymentMethod?: PaymentMethod;
    tax?: number;
    discount?: number;
    items?: Array<{ productId: number; quantity: number; unitPrice?: number }>;
  }) {
    // Generar el correlativo único de factura (ej: INV-2026-0001)
    const count = await prisma.sale.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    let subtotal = 0;
    const saleDetailsData: any[] = [];

    // Caso 1: Facturar a partir de una comanda previamente tomada
    if (data.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: Number(data.orderId) },
        include: { orderDetails: true }
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      subtotal = order.total;

      for (const detail of order.orderDetails) {
        saleDetailsData.push({
          productId: detail.productId,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          subtotal: detail.subtotal
        });
      }
    } 
    // Caso 2: Venta directa en caja sin crear comanda previa
    else if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      for (const item of data.items) {
        const prodId = Number(item.productId);
        const qty = Number(item.quantity);
        const product = await prisma.product.findUnique({ where: { id: prodId } });

        if (!product) {
          throw new Error(`PRODUCT_NOT_FOUND:${prodId}`);
        }

        const unitPrice = Number(item.unitPrice ?? product.salePrice);
        const itemSubtotal = unitPrice * qty;
        subtotal += itemSubtotal;

        saleDetailsData.push({
          productId: prodId,
          quantity: qty,
          unitPrice,
          subtotal: itemSubtotal
        });
      }
    } else {
      throw new Error('INVALID_PAYLOAD');
    }

    // Calcular impuestos, descuentos y total neto a cobrar
    const calculatedTax = Number(data.tax || 0);
    const calculatedDiscount = Number(data.discount || 0);
    const total = subtotal + calculatedTax - calculatedDiscount;

    return prisma.sale.create({
      data: {
        invoiceNumber,
        orderId: data.orderId ? Number(data.orderId) : null,
        subtotal,
        tax: calculatedTax,
        discount: calculatedDiscount,
        total,
        paymentMethod: data.paymentMethod || 'CASH',
        saleDetails: {
          create: saleDetailsData
        }
      },
      include: {
        order: true,
        saleDetails: {
          include: { product: true }
        }
      }
    });
  }
}

export const saleService = new SaleService();
