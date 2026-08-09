/**
 * ====================================================
 * RUTAS DE KARDEX Y ALERTAS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de InventoryController.
 */

import { Router } from 'express';
import { inventoryController } from '../controllers/inventory.controller';

const router = Router();

// Endpoint GET: Historial de movimientos de entradas y salidas de almacén (Kardex)
router.get('/movements', (req, res) => inventoryController.getMovements(req, res));

// Endpoint GET: Listado de insumos que alcanzaron o superaron el stock mínimo crítico
router.get('/alerts', (req, res) => inventoryController.getAlerts(req, res));

export default router;
