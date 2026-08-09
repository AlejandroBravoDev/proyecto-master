/**
 * ====================================================
 * CONTROLADOR DE KARDEX Y ALERTAS (CONTROLLER LAYER)
 * ====================================================
 * Proporciona endpoints de auditoría de movimientos y alertas de insumos.
 */

import { Request, Response } from 'express';
import { inventoryService } from '../services/inventory.service';

export class InventoryController {
  /**
   * GET /api/inventory/movements
   * Retorna el historial de movimientos de inventario (Kardex).
   */
  async getMovements(req: Request, res: Response) {
    try {
      const { ingredientId, type, reason } = req.query;

      const movements = await inventoryService.getMovements({
        ingredientId: ingredientId ? Number(ingredientId) : undefined,
        type: type ? String(type) : undefined,
        reason: reason ? String(reason) : undefined
      });

      return res.json(movements);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener movimientos de inventario', details: error });
    }
  }

  /**
   * GET /api/inventory/alerts
   * Retorna la lista de insumos que han alcanzado su stock mínimo.
   */
  async getAlerts(_req: Request, res: Response) {
    try {
      const alerts = await inventoryService.getLowStockAlerts();
      return res.json(alerts);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener alertas de stock', details: error });
    }
  }
}

export const inventoryController = new InventoryController();
