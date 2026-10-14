/**
 * ====================================================
 * RUTAS DE CATEGORÍAS (ROUTER LAYER)
 * ====================================================
 * Mapeo de métodos HTTP (GET, POST, PUT, DELETE) hacia
 * las funciones correspondientes del CategoryController.
 */

import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { requireRole } from '../middleware/auth.middleware';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Un :id que no sea entero positivo responde 400 en lugar de llegar a Prisma (500)
router.param('id', validateIdParam);

// Endpoint GET: Lista todas las categorías (cualquier usuario autenticado)
router.get('/', (req, res) => categoryController.getCategories(req, res));

// Endpoint GET: Obtiene una categoría específica por su ID (cualquier usuario autenticado)
router.get('/:id', (req, res) => categoryController.getCategoryById(req, res));

// Endpoint POST: Crea una nueva categoría (solo ADMIN)
router.post('/', requireRole('ADMIN'), (req, res) => categoryController.createCategory(req, res));

// Endpoint PUT: Actualiza una categoría por su ID (solo ADMIN)
router.put('/:id', requireRole('ADMIN'), (req, res) => categoryController.updateCategory(req, res));

// Endpoint DELETE: Elimina una categoría por su ID (solo ADMIN)
router.delete('/:id', requireRole('ADMIN'), (req, res) => categoryController.deleteCategory(req, res));

export default router;
