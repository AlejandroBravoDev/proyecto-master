/**
 * ====================================================
 * RUTAS DE DASHBOARD / KPIS
 * ====================================================
 * Define las rutas relativas al Dashboard.
 */

import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard/kpis - Obtener métricas KPI numéricas
router.get('/kpis', dashboardController.getKpis);

export default router;
