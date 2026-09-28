/**
 * ====================================================
 * RUTAS DE CAJA Y ARQUEO (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de CajaController.
 */

import { Router } from 'express';
import { cajaController } from '../controllers/caja.controller';

const router = Router();

// Endpoint GET: Consultar el estado en tiempo real de la caja (abierta / cerrada)
router.get('/status', (req, res) => cajaController.getStatus(req, res));

// Endpoint POST: Apertura de caja con base inicial (desglose de monedas y billetes)
router.post('/open', (req, res) => cajaController.openSession(req, res));

// Endpoint POST: Cierre de caja con conteo final y archivado de comandas
router.post('/close', (req, res) => cajaController.closeSession(req, res));

// Endpoint PUT: Edición administrativa de una sesión de caja
router.put('/:id', (req, res) => cajaController.updateSession(req, res));

// Endpoint GET: Historial de sesiones de caja (con filtro opcional por usuario)
router.get('/history', (req, res) => cajaController.getHistory(req, res));

// Endpoint GET: Detalle completo de una sesión de caja específica por ID
router.get('/session/:id', (req, res) => cajaController.getSessionById(req, res));

export default router;
