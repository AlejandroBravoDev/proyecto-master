/**
 * ====================================================
 * RUTAS DE INSUMOS E INVENTARIO (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de IngredientController.
 */

import { Router } from 'express';
import { ingredientController } from '../controllers/ingredient.controller';

const router = Router();

// Endpoint GET: Listar todo el inventario de materias primas
router.get('/', (req, res) => ingredientController.getIngredients(req, res));

// Endpoint GET: Consultar un insumo y su historial de movimientos
router.get('/:id', (req, res) => ingredientController.getIngredientById(req, res));

// Endpoint POST: Registrar un insumo nuevo en el sistema
router.post('/', (req, res) => ingredientController.createIngredient(req, res));

// Endpoint PUT: Actualizar datos de insumo o realizar ajustes de stock
router.put('/:id', (req, res) => ingredientController.updateIngredient(req, res));

// Endpoint DELETE: Eliminar un insumo
router.delete('/:id', (req, res) => ingredientController.deleteIngredient(req, res));

export default router;
