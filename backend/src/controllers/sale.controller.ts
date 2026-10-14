/**
 * ====================================================
 * CONTROLADOR DE VENTAS Y FACTURACIÓN (CONTROLLER LAYER)
 * ====================================================
 * Procesa el cobro y la emisión de comprobantes de venta.
 */

import { Request, Response } from 'express';
import { saleService } from '../services/sale.service';
import { errorDetails, parseId } from '../utils/http.utils';

export class SaleController {
  /**
   * GET /api/sales
   * Obtiene la lista de facturas de venta.
   */
  async getSales(_req: Request, res: Response) {
    try {
      const sales = await saleService.getAllSales();
      return res.json(sales);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener las ventas', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/sales/:id
   * Obtiene el detalle de una factura por ID.
   */
  async getSaleById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const sale = await saleService.getSaleById(id);

      if (!sale) {
        return res.status(404).json({ error: 'Venta no encontrada' });
      }

      return res.json(sale);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener la venta', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/sales
   * Emite una factura a partir de una comanda u orden directa.
   */
  async createSale(req: Request, res: Response) {
    try {
      const { orderId, paymentMethod, tax, discount, items } = req.body ?? {};

      // orderId vacío (undefined, null o '') significa "venta directa con items"
      let parsedOrderId: number | undefined;
      if (orderId !== undefined && orderId !== null && orderId !== '') {
        const parsed = parseId(orderId);
        if (parsed === null) {
          return res.status(400).json({ error: 'orderId inválido' });
        }
        parsedOrderId = parsed;
      }

      const sale = await saleService.createSale({ orderId: parsedOrderId, paymentMethod, tax, discount, items });
      return res.status(201).json(sale);
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({ error: 'Comanda no encontrada' });
      }
      if (error.message === 'INVALID_PAYLOAD') {
        return res.status(400).json({ error: 'Se debe proporcionar orderId o la lista de ítems' });
      }
      if (error.message?.startsWith('PRODUCT_NOT_FOUND:')) {
        return res.status(400).json({ error: `Producto ID ${error.message.split(':')[1]} no encontrado` });
      }
      if (error.message === 'INVALID_ITEM') {
        return res.status(400).json({ error: 'Cada ítem debe tener un productId válido, una cantidad entera mayor a 0 y un precio mayor o igual a 0' });
      }
      if (error.message === 'INVALID_AMOUNT') {
        return res.status(400).json({ error: 'El impuesto y el descuento deben ser números mayores o iguales a 0' });
      }
      if (error.message === 'INVALID_PAYMENT_METHOD') {
        return res.status(400).json({ error: 'Forma de pago inválida. Use CASH, CARD, TRANSFER o MIXED' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Esta comanda ya ha sido facturada previamente' });
      }
      return res.status(500).json({ error: 'Error al facturar la venta', details: errorDetails(error) });
    }
  }
}

export const saleController = new SaleController();
