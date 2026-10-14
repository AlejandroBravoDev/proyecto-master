/**
 * ====================================================
 * RUTAS DE PRODUCTOS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de ProductController.
 */

import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { requireAdminOrFields, requireRole } from '../middleware/auth.middleware';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Un :id que no sea entero positivo responde 400 en lugar de llegar a Prisma (500)
router.param('id', validateIdParam);

// Endpoint GET: Consultar productos con filtros opcionales por Query Params (cualquier usuario autenticado)
router.get('/', (req, res) => productController.getProducts(req, res));

// Endpoint GET: Consultar producto específico por ID (cualquier usuario autenticado)
router.get('/:id', (req, res) => productController.getProductById(req, res));

// Endpoint POST: Registrar un nuevo producto, con o sin receta (solo ADMIN)
router.post('/', requireRole('ADMIN'), (req, res) => productController.createProduct(req, res));

// Endpoint PUT: Modificar un producto existente. ADMIN: cualquier campo. WORKER: solo `available`
// (marcar disponible / agotado, que es lo único que la interfaz le permite)
router.put('/:id', requireAdminOrFields('available'), (req, res) => productController.updateProduct(req, res));

// Endpoint DELETE: Eliminar un producto (solo ADMIN)
router.delete('/:id', requireRole('ADMIN'), (req, res) => productController.deleteProduct(req, res));

export default router;
