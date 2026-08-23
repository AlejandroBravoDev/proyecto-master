/**
 * ====================================================
 * SERVICIO DE DASHBOARD Y KPIS (MODEL/SERVICE LAYER)
 * ====================================================
 * Calcula y procesa las métricas principales (KPIs) para el Dashboard:
 * - Ingresos Totales (total Revenue de las ventas)
 * - Cantidad Vendida (total de ítems/unidades vendidas)
 * - Ganancia Bruta (Ingresos Totales - Costo Total de Insumos consumidos en recetas/productos)
 * - Alertas de Stock (cantidad de insumos con stock actual <= stock mínimo)
 * - Productos Más Vendidos (Top de productos ordenados descendentemente por unidades vendidas)
 * - Estado de Inventario Crítico (Insumos activos con stock bajo o igual al mínimo con % restante)
 */

import prisma from '../prisma/client';

export class DashboardService {
  /**
   * Calcula la fecha de inicio según el período solicitado.
   * @param period 'day' | 'month' | 'year'
   */
  private getStartDate(period: string): Date {
    const now = new Date();
    const startDate = new Date(now);

    if (period === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'year') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Por defecto 'day'
      startDate.setHours(0, 0, 0, 0);
    }

    return startDate;
  }

  /**
   * Calcula los KPIs principales del sistema consultando datos reales de la BD filtrados por período.
   * @param period 'day' | 'month' | 'year' (por defecto 'day')
   */
  async getKpis(period: string = 'day') {
    const startDate = this.getStartDate(period);

    // 1. Obtener las ventas filtradas por fecha de creación (createdAt >= startDate)
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      include: {
        saleDetails: {
          include: {
            product: {
              include: {
                recipe: {
                  include: {
                    recipeDetails: {
                      include: {
                        ingredient: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    let totalRevenue = 0;
    let totalItemsSold = 0;
    let totalCostOfGoodsSold = 0;

    // Mapa para acumular unidades vendidas por producto { productId: { name, totalSold } }
    const productSalesMap: Record<number, { id: number; name: string; totalSold: number }> = {};

    for (const sale of sales) {
      totalRevenue += sale.total;

      for (const detail of sale.saleDetails) {
        totalItemsSold += detail.quantity;

        const product = detail.product;
        if (product) {
          // Acumular conteo de ventas por producto para el Top de más vendidos
          if (!productSalesMap[product.id]) {
            productSalesMap[product.id] = {
              id: product.id,
              name: product.name,
              totalSold: 0
            };
          }
          productSalesMap[product.id].totalSold += detail.quantity;

          // Calcular el costo unitario del producto basado en su receta
          let unitCost = 0;
          if (product.recipe && product.recipe.recipeDetails.length > 0) {
            for (const rd of product.recipe.recipeDetails) {
              const ingCost = rd.ingredient ? rd.ingredient.unitCost : 0;
              unitCost += rd.quantity * ingCost;
            }
          }

          totalCostOfGoodsSold += unitCost * detail.quantity;
        }
      }
    }

    // Ordenar productos de mayor a menor según cantidad vendida
    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.totalSold - a.totalSold);

    // 2. Ganancia bruta = Ingresos Totales - Costo de lo vendido
    const grossProfit = totalRevenue - totalCostOfGoodsSold;

    // 3. Obtener insumos activos para evaluar estado de inventario crítico
    const activeIngredients = await prisma.ingredient.findMany({
      where: { active: true }
    });

    const criticalIngredientsList = activeIngredients.filter(
      (ing) => ing.currentStock <= ing.minimumStock
    );

    const stockAlertsCount = criticalIngredientsList.length;

    // Mapear lista de insumos críticos con su porcentaje restante
    const criticalStockIngredients = criticalIngredientsList.map((ing) => {
      let percentageRemaining = 0;
      if (ing.minimumStock > 0) {
        percentageRemaining = Math.max(0, Math.round((ing.currentStock / ing.minimumStock) * 100));
      } else if (ing.currentStock <= 0) {
        percentageRemaining = 0;
      } else {
        percentageRemaining = 100;
      }

      return {
        id: ing.id,
        name: ing.name,
        currentStock: ing.currentStock,
        minimumStock: ing.minimumStock,
        measurementUnit: ing.measurementUnit,
        percentageRemaining
      };
    });

    // Retornar métricas completas con datos reales de la BD
    return {
      period,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalItemsSold: Number(totalItemsSold),
      grossProfit: Number(grossProfit.toFixed(2)),
      stockAlertsCount: Number(stockAlertsCount),
      topSellingProducts,
      criticalStockIngredients
    };
  }
}

export const dashboardService = new DashboardService();
