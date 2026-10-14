/**
 * ====================================================
 * RUTAS DE VENTAS Y FACTURACIÓN (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de SaleController.
 */

import { Router } from 'express';
import { saleController } from '../controllers/sale.controller';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Un :id que no sea entero positivo responde 400 en lugar de llegar a Prisma (500)
router.param('id', validateIdParam);

// Endpoint GET: Consultar el historial de ventas y facturas emitidas
router.get('/', (req, res) => saleController.getSales(req, res));

// Endpoint GET: Consultar el detalle de una factura por ID
router.get('/:id', (req, res) => saleController.getSaleById(req, res));

// Endpoint POST: Procesar pago y emitir una nueva factura de venta
router.post('/', (req, res) => saleController.createSale(req, res));

export default router;
