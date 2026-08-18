/**
 * ====================================================
 * SERVICIO DE DASHBOARD Y KPIS (MODEL/SERVICE LAYER)
 * ====================================================
 * Calcula y procesa las métricas principales (KPIs) para el Dashboard:
 * - Ingresos Totales (total Revenue de las ventas)
 * - Cantidad Vendida (total de ítems/unidades vendidas)
 * - Ganancia Bruta (Ingresos Totales - Costo Total de Insumos consumidos en recetas/productos)
 * - Alertas de Stock (cantidad de insumos con stock actual <= stock mínimo)
 */

import prisma from '../prisma/client';

export class DashboardService {
  /**
   * Calcula los KPIs principales del sistema devolviendo únicamente valores numéricos.
   */
  async getKpis() {
    // 1. Obtener todas las ventas y sus detalles con las relaciones necesarias
    const sales = await prisma.sale.findMany({
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

    for (const sale of sales) {
      totalRevenue += sale.total;

      for (const detail of sale.saleDetails) {
        totalItemsSold += detail.quantity;

        const product = detail.product;
        if (!product) continue;

        // Calcular el costo unitario del producto basado en su receta si la tiene
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

    // 2. Ganancia bruta = Ingresos Totales - Costo de lo vendido
    const grossProfit = totalRevenue - totalCostOfGoodsSold;

    // 3. Contar la cantidad de insumos activos con alerta de stock (stock actual <= stock mínimo)
    const activeIngredients = await prisma.ingredient.findMany({
      where: { active: true }
    });

    const stockAlertsCount = activeIngredients.filter(
      (ing) => ing.currentStock <= ing.minimumStock
    ).length;

    // Retornar métricas solo en formato numérico
    return {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalItemsSold: Number(totalItemsSold),
      grossProfit: Number(grossProfit.toFixed(2)),
      stockAlertsCount: Number(stockAlertsCount)
    };
  }
}

export const dashboardService = new DashboardService();
