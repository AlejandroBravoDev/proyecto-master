/**
 * ====================================================
 * RUTAS DE VENTAS Y FACTURACIÓN (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de SaleController.
 */

import { Router } from 'express';
import { saleController } from '../controllers/sale.controller';

const router = Router();

// Endpoint GET: Consultar el historial de ventas y facturas emitidas
router.get('/', (req, res) => saleController.getSales(req, res));

// Endpoint GET: Consultar el detalle de una factura por ID
router.get('/:id', (req, res) => saleController.getSaleById(req, res));

// Endpoint POST: Procesar pago y emitir una nueva factura de venta
router.post('/', (req, res) => saleController.createSale(req, res));

export default router;
