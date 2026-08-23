/**
 * ====================================================
 * CONTROLADOR DE DASHBOARD (API CONTROLLER)
 * ====================================================
 * Procesa la petición GET /api/dashboard/kpis y responde
 * con las estadísticas numéricas para el Dashboard.
 */

import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';

export class DashboardController {
  /**
   * GET /api/dashboard/kpis?period=day|month|year
   * Retorna las métricas principales (KPIs) filtradas por período.
   */
  async getKpis(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as string) || 'day';
      const kpis = await dashboardService.getKpis(period);
      return res.status(200).json(kpis);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
