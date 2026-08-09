/**
 * ====================================================
 * SERVICIO DE KARDEX E INVENTARIOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Proporciona consultas de movimientos de almacén y
 * reporte de alertas de nivel crítico de insumos.
 */

import prisma from '../prisma/client';

export class InventoryService {
  /**
   * Consulta el historial de movimientos de inventario (Kardex) aplicando filtros.
   * @param filters Filtros por insumo, tipo de movimiento (IN/OUT) o razón
   */
  async getMovements(filters?: { ingredientId?: number; type?: string; reason?: string }) {
    const whereClause: any = {};
    if (filters?.ingredientId) whereClause.ingredientId = Number(filters.ingredientId);
    if (filters?.type) whereClause.type = String(filters.type);
    if (filters?.reason) whereClause.reason = String(filters.reason);

    return prisma.inventoryMovement.findMany({
      where: whereClause,
      include: { ingredient: true },
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Identifica los insumos cuyo stock actual es menor o igual a su stock mínimo configurado.
   */
  async getLowStockAlerts() {
    const allIngredients = await prisma.ingredient.findMany({
      where: { active: true }
    });

    // Filtrar insumos en estado crítico (Stock Actual <= Stock Mínimo)
    return allIngredients.filter((ing) => ing.currentStock <= ing.minimumStock);
  }
}

export const inventoryService = new InventoryService();
