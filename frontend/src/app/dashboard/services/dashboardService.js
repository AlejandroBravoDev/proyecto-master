/**
 * Dashboard Service
 * Handles API data fetching and endpoint interactions for the dashboard module.
 */

/**
 * Fetches dashboard summary metrics.
 * @returns {Promise<Array<{id: string, title: string, rawValue: number, type: 'currency'|'number'|'percentage', change: number, description: string, category: string}>>}
 */
export async function fetchDashboardMetrics() {
  // Simulating async API endpoint response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: 'total-revenue',
          title: 'Ingresos Totales',
          rawValue: 45231.89,
          type: 'currency',
          change: 20.1,
          description: 'respecto al mes anterior',
          category: 'revenue',
        },
        {
          id: 'active-users',
          title: 'Usuarios Activos',
          rawValue: 2350,
          type: 'number',
          change: 180.1,
          description: 'respecto a la semana pasada',
          category: 'users',
        },
        {
          id: 'system-uptime',
          title: 'Rendimiento del Sistema',
          rawValue: 99.9,
          type: 'percentage',
          change: 0.4,
          description: 'tiempo de actividad (Uptime)',
          category: 'system',
        },
      ]);
    }, 150);
  });
}
