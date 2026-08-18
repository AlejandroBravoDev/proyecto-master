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
   * GET /api/dashboard/kpis
   * Retorna las métricas principales (KPIs) en números.
   */
  async getKpis(_req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await dashboardService.getKpis();
      return res.status(200).json(kpis);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
