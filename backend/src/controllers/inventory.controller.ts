/**
 * ====================================================
 * CONTROLADOR DE KARDEX Y ALERTAS (CONTROLLER LAYER)
 * ====================================================
 * Proporciona endpoints de auditoría de movimientos y alertas de insumos.
 */

import { Request, Response } from 'express';
import { MovementReason, MovementType } from '@prisma/client';
import { inventoryService } from '../services/inventory.service';
import { errorDetails, parseId, parsePagination } from '../utils/http.utils';

const MOVEMENT_TYPES: string[] = Object.values(MovementType);
const MOVEMENT_REASONS: string[] = Object.values(MovementReason);

export class InventoryController {
  /**
   * GET /api/inventory/movements
   * Retorna el historial de movimientos de inventario (Kardex).
   * Sin ?page ni ?limit devuelve el arreglo completo; con alguno de ellos devuelve
   * `{ total, page, limit, totalPages, movements }` paginado en el servidor.
   */
  async getMovements(req: Request, res: Response) {
    try {
      const { ingredientId, type, reason } = req.query;

      let parsedIngredientId: number | undefined;
      if (ingredientId !== undefined && ingredientId !== '') {
        const parsed = parseId(ingredientId);
        if (parsed === null) {
          return res.status(400).json({ error: 'ingredientId inválido' });
        }
        parsedIngredientId = parsed;
      }
      if (type !== undefined && type !== '' && !MOVEMENT_TYPES.includes(String(type))) {
        return res.status(400).json({ error: `El tipo de movimiento debe ser ${MOVEMENT_TYPES.join(', ')}` });
      }
      if (reason !== undefined && reason !== '' && !MOVEMENT_REASONS.includes(String(reason))) {
        return res.status(400).json({ error: `El motivo del movimiento debe ser ${MOVEMENT_REASONS.join(', ')}` });
      }

      const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 500 });
      if (pagination === null) {
        return res.status(400).json({ error: 'page y limit deben ser enteros mayores a 0' });
      }

      const filters = {
        ingredientId: parsedIngredientId,
        type: type ? String(type) : undefined,
        reason: reason ? String(reason) : undefined
      };

      if (pagination) {
        return res.json(await inventoryService.getMovementsPage(filters, pagination));
      }

      return res.json(await inventoryService.getMovements(filters));
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener movimientos de inventario', details: errorDetails(error) });
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
      return res.status(500).json({ error: 'Error al obtener alertas de stock', details: errorDetails(error) });
    }
  }
}

export const inventoryController = new InventoryController();
