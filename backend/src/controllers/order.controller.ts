/**
 * ====================================================
 * CONTROLADOR DE COMANDAS Y PEDIDOS (CONTROLLER LAYER)
 * ====================================================
 * Procesa la recepción de comandas enviadas desde punto de venta o meseros.
 */

import { Request, Response } from 'express';
import { INSUFFICIENT_STOCK_PREFIX, orderService, parseInsufficientStock } from '../services/order.service';
import { errorDetails, parseId } from '../utils/http.utils';

/** Fecha válida en formato YYYY-MM-DD (rechaza "2026-13-45" y texto libre). */
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !isNaN(new Date(`${value}T00:00:00.000`).getTime());
}

export class OrderController {
  /**
   * GET /api/orders
   * Retorna el listado de comandas con filtrado opcional por scope (active/all), date o cashSessionId.
   */
  async getOrders(req: Request, res: Response) {
    try {
      const scope = req.query.scope ? String(req.query.scope) : undefined;
      const date = req.query.date ? String(req.query.date) : undefined;

      if (date !== undefined && !isValidDateString(date.trim())) {
        return res.status(400).json({ error: 'La fecha debe tener el formato YYYY-MM-DD' });
      }

      let cashSessionId: number | undefined;
      if (req.query.cashSessionId !== undefined && req.query.cashSessionId !== '') {
        const parsed = parseId(req.query.cashSessionId);
        if (parsed === null) {
          return res.status(400).json({ error: 'cashSessionId inválido' });
        }
        cashSessionId = parsed;
      }

      const orders = await orderService.getAllOrders({ scope, date, cashSessionId });
      return res.json(orders);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener comandas', details: errorDetails(error) });
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
      return res.status(500).json({ error: 'Error al obtener la comanda', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/orders
   * Crea una comanda, valida caja abierta y stock suficiente, registra la Venta (Sale) y descuenta insumos.
   * Si algún insumo no alcanza responde 400 con el detalle (`shortages`) y no crea nada.
   */
  async createOrder(req: Request, res: Response) {
    try {
      const { items, notes, paymentMethod, tax, discount } = req.body ?? {};

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
      if (error.message?.startsWith(INSUFFICIENT_STOCK_PREFIX)) {
        const shortages = parseInsufficientStock(error.message);
        const detail = shortages
          .map((s) => `${s.name} (necesario: ${s.needed} ${s.measurementUnit}, disponible: ${s.available} ${s.measurementUnit})`)
          .join('; ');
        return res.status(400).json({
          error: `Stock insuficiente para completar la comanda: ${detail}`,
          shortages
        });
      }
      if (error.message === 'INVALID_ITEM') {
        return res.status(400).json({ error: 'Cada producto de la comanda debe tener un productId válido y una cantidad entera mayor a 0' });
      }
      if (error.message === 'INVALID_AMOUNT') {
        return res.status(400).json({ error: 'El impuesto y el descuento deben ser números mayores o iguales a 0' });
      }
      if (error.message === 'INVALID_PAYMENT_METHOD') {
        return res.status(400).json({ error: 'Forma de pago inválida. Use CASH, CARD, TRANSFER o MIXED' });
      }
      return res.status(500).json({ error: 'Error al crear la comanda', details: errorDetails(error) });
    }
  }

  /**
   * DELETE /api/orders/:id
   * Elimina una comanda y su venta y devuelve el stock de los insumos que consumió
   * (movimientos IN compensatorios en el Kardex).
   */
  async deleteOrder(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await orderService.deleteOrder(id);
      return res.json({ message: 'Comanda eliminada correctamente' });
    } catch (error: any) {
      if (error.message === 'ORDER_NOT_FOUND' || error.code === 'P2025') {
        return res.status(404).json({ error: 'Comanda no encontrada' });
      }
      return res.status(500).json({ error: 'Error al eliminar la comanda', details: errorDetails(error) });
    }
  }
}

export const orderController = new OrderController();
