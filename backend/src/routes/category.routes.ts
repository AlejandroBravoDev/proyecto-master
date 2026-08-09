/**
 * ====================================================
 * RUTAS DE CATEGORÍAS (ROUTER LAYER)
 * ====================================================
 * Mapeo de métodos HTTP (GET, POST, PUT, DELETE) hacia
 * las funciones correspondientes del CategoryController.
 */

import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';

const router = Router();

// Endpoint GET: Lista todas las categorías
router.get('/', (req, res) => categoryController.getCategories(req, res));

// Endpoint GET: Obtiene una categoría específica por su ID
router.get('/:id', (req, res) => categoryController.getCategoryById(req, res));

// Endpoint POST: Crea una nueva categoría
router.post('/', (req, res) => categoryController.createCategory(req, res));

// Endpoint PUT: Actualiza una categoría por su ID
router.put('/:id', (req, res) => categoryController.updateCategory(req, res));

// Endpoint DELETE: Elimina una categoría por su ID
router.delete('/:id', (req, res) => categoryController.deleteCategory(req, res));

export default router;
