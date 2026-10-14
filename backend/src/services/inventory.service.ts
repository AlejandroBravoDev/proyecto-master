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
   * Construye el filtro WHERE de los movimientos.
   */
  private buildMovementsWhere(filters?: { ingredientId?: number; type?: string; reason?: string }) {
    const whereClause: any = {};
    if (filters?.ingredientId) whereClause.ingredientId = Number(filters.ingredientId);
    if (filters?.type) whereClause.type = String(filters.type);
    if (filters?.reason) whereClause.reason = String(filters.reason);
    return whereClause;
  }

  /**
   * Consulta el historial de movimientos de inventario (Kardex) aplicando filtros.
   * @param filters Filtros por insumo, tipo de movimiento (IN/OUT) o razón
   */
  async getMovements(filters?: { ingredientId?: number; type?: string; reason?: string }) {
    return prisma.inventoryMovement.findMany({
      where: this.buildMovementsWhere(filters),
      include: { ingredient: true },
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Igual que `getMovements` pero paginado en el servidor.
   * Devuelve `{ total, page, limit, totalPages, movements }`.
   * @param filters Filtros por insumo, tipo de movimiento (IN/OUT) o razón
   * @param pagination Página (desde 1) y filas por página
   */
  async getMovementsPage(
    filters: { ingredientId?: number; type?: string; reason?: string } | undefined,
    pagination: { page: number; limit: number }
  ) {
    const where = this.buildMovementsWhere(filters);

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        include: { ingredient: true },
        // `id desc` desempata movimientos con la misma fecha para que las páginas no se repitan
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit
      })
    ]);

    return {
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
      movements
    };
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
