/**
 * ====================================================
 * RUTAS DE COMANDAS Y PEDIDOS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de OrderController.
 */

import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Un :id que no sea entero positivo responde 400 en lugar de llegar a Prisma (500)
router.param('id', validateIdParam);

// Todas las rutas de comandas son para cualquier usuario autenticado, pero el WORKER solo puede
// ver y eliminar las comandas del turno actual: ese filtro por rol vive en OrderController
// (403 si pide el historial o una comanda de un turno anterior).

// Endpoint GET: Consultar las comandas (por defecto, las del turno actual)
router.get('/', (req, res) => orderController.getOrders(req, res));

// Endpoint GET: Consultar una comanda específica por su ID
router.get('/:id', (req, res) => orderController.getOrderById(req, res));

// Endpoint POST: Registrar una nueva comanda (descuenta stock automáticamente)
router.post('/', (req, res) => orderController.createOrder(req, res));

// Endpoint DELETE: Cancelar o eliminar una comanda
router.delete('/:id', (req, res) => orderController.deleteOrder(req, res));

export default router;
