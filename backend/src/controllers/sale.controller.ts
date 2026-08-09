/**
 * ====================================================
 * CONTROLADOR DE VENTAS Y FACTURACIÓN (CONTROLLER LAYER)
 * ====================================================
 * Procesa el cobro y la emisión de comprobantes de venta.
 */

import { Request, Response } from 'express';
import { saleService } from '../services/sale.service';

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
      return res.status(500).json({ error: 'Error al obtener las ventas', details: error });
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
      return res.status(500).json({ error: 'Error al obtener la venta', details: error });
    }
  }

  /**
   * POST /api/sales
   * Emite una factura a partir de una comanda u orden directa.
   */
  async createSale(req: Request, res: Response) {
    try {
      const { orderId, paymentMethod, tax, discount, items } = req.body;

      const sale = await saleService.createSale({ orderId, paymentMethod, tax, discount, items });
      return res.status(201).json(sale);
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND') {
        return res.status(404).json({ error: 'Comanda no encontrada' });
      }
      if (error.message === 'INVALID_PAYLOAD') {
        return res.status(400).json({ error: 'Se debe proporcionar orderId o la lista de ítems' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Esta comanda ya ha sido facturada previamente' });
      }
      return res.status(500).json({ error: 'Error al facturar la venta', details: error.message || error });
    }
  }
}

export const saleController = new SaleController();
