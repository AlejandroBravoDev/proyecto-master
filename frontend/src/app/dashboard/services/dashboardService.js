/**
 * Dashboard Service
 * Handles real API data fetching for the dashboard module using centralized endpoints.
 */

import { requestJson } from '../../../config/apiFetch';
import { DASHBOARD_ENDPOINTS } from './endpoints';

/**
 * Fetches real KPI metrics, top selling products and critical stock filtered by period.
 * Cards carry only data that comes from the backend (no invented trends).
 * @param {'day'|'month'|'year'} period - Filter period: 'day', 'month', or 'year'. Defaults to 'day'.
 * @returns {Promise<{
 *   period: string,
 *   cards: Array<{id: string, key: string, title: string, rawValue: number, type: 'currency'|'number', category: string, description: string}>,
 *   topSellingProducts: Array<{id: number|string, name: string, totalSold: number}>,
 *   criticalStockIngredients: Array<{id: number|string, name: string, currentStock: number, minimumStock: number, percentageRemaining: number}>
 * }>}
 */
export async function fetchDashboardKPIs(period = 'day') {
  const url = `${DASHBOARD_ENDPOINTS.KPIS}?period=${encodeURIComponent(period)}`;

  const kpis = await requestJson(url, {}, 'No se pudieron obtener los KPIs.');

  return {
    period: kpis.period || period,
    cards: [
      {
        id: 'total-revenue',
        key: 'totalRevenue',
        title: 'Ingresos Totales',
        rawValue: kpis.totalRevenue ?? 0,
        type: 'currency',
        category: 'totalRevenue',
        description: 'Facturación bruta acumulada',
      },
      {
        id: 'total-items-sold',
        key: 'totalItemsSold',
        title: 'Cantidad Vendida',
        rawValue: kpis.totalItemsSold ?? 0,
        type: 'number',
        category: 'totalItemsSold',
        description: 'Unidades despachadas',
      },
      {
        id: 'gross-profit',
        key: 'grossProfit',
        title: 'Ganancia Bruta',
        rawValue: kpis.grossProfit ?? 0,
        type: 'currency',
        category: 'grossProfit',
        description: 'Margen neto después de costos',
      },
      {
        id: 'stock-alerts',
        key: 'stockAlertsCount',
        title: 'Alertas de Stock',
        rawValue: kpis.stockAlertsCount ?? 0,
        type: 'number',
        category: 'stockAlertsCount',
        description: 'Productos con bajo inventario',
      },
    ],
    topSellingProducts: Array.isArray(kpis.topSellingProducts) ? kpis.topSellingProducts : [],
    criticalStockIngredients: Array.isArray(kpis.criticalStockIngredients) ? kpis.criticalStockIngredients : [],
  };
}
