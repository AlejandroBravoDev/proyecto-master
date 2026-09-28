/**
 * ====================================================
 * CONTROLADOR DE COMANDAS Y PEDIDOS (CONTROLLER LAYER)
 * ====================================================
 * Procesa la recepción de comandas enviadas desde punto de venta o meseros.
 */

import { Request, Response } from 'express';
import { orderService } from '../services/order.service';

export class OrderController {
  /**
   * GET /api/orders
   * Retorna el listado de comandas con filtrado opcional por scope (active/all), date o cashSessionId.
   */
  async getOrders(req: Request, res: Response) {
    try {
      const scope = req.query.scope ? String(req.query.scope) : undefined;
      const date = req.query.date ? String(req.query.date) : undefined;
      const cashSessionId = req.query.cashSessionId ? Number(req.query.cashSessionId) : undefined;

      const orders = await orderService.getAllOrders({ scope, date, cashSessionId });
      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener comandas', details: error });
    }
  }

  /**
   * GET /api/orders/:id
   * Retorna el detalle de una comanda por ID.
   */
  async getOrderById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const order = await orderService.getOrderById(id);

      if (!order) {
        return res.status(404).json({ error: 'Comanda no encontrada' });
      }

      return res.json(order);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener la comanda', details: error });
    }
  }

  /**
   * POST /api/orders
   * Crea una comanda, valida caja abierta, registra la Venta (Sale) y descuenta insumos.
   */
  async createOrder(req: Request, res: Response) {
    try {
      const { items, notes, paymentMethod, tax, discount } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La comanda debe incluir al menos un producto' });
      }

      const result = await orderService.createOrder({ items, notes, paymentMethod, tax, discount });
      return res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'CAJA_CERRADA') {
        return res.status(400).json({ error: 'No se puede crear la comanda porque la caja está cerrada. Abra un turno de caja primero.' });
      }
      if (error.message?.startsWith('PRODUCT_NOT_FOUND:')) {
        return res.status(400).json({ error: `Producto ID ${error.message.split(':')[1]} no encontrado` });
      }
      if (error.message?.startsWith('PRODUCT_UNAVAILABLE:')) {
        return res.status(400).json({ error: `El producto "${error.message.split(':')[1]}" no está disponible` });
      }
      return res.status(500).json({ error: 'Error al crear la comanda', details: error.message || error });
    }
  }

  /**
   * DELETE /api/orders/:id
   * Cancela o elimina una comanda.
   */
  async deleteOrder(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await orderService.deleteOrder(id);
      return res.json({ message: 'Comanda eliminada correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Comanda no encontrada' });
      }
      return res.status(500).json({ error: 'Error al eliminar la comanda', details: error });
    }
  }
}

export const orderController = new OrderController();
