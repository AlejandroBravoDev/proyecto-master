/**
 * ====================================================
 * RUTAS DE COMANDAS Y PEDIDOS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de OrderController.
 */

import { Router } from 'express';
import { orderController } from '../controllers/order.controller';

const router = Router();

// Endpoint GET: Consultar el historial de comandas registradas
router.get('/', (req, res) => orderController.getOrders(req, res));

// Endpoint GET: Consultar una comanda específica por su ID
router.get('/:id', (req, res) => orderController.getOrderById(req, res));

// Endpoint POST: Registrar una nueva comanda (descuenta stock automáticamente)
router.post('/', (req, res) => orderController.createOrder(req, res));

// Endpoint DELETE: Cancelar o eliminar una comanda
router.delete('/:id', (req, res) => orderController.deleteOrder(req, res));

export default router;
