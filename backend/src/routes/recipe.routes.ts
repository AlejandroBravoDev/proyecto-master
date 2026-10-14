/**
 * ====================================================
 * RUTAS DE RECETAS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de RecipeController.
 */

import { Router } from 'express';
import { recipeController } from '../controllers/recipe.controller';
import { requireRole } from '../middleware/auth.middleware';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Un :id o :productId que no sea entero positivo responde 400 en lugar de llegar a Prisma (500)
router.param('id', validateIdParam);
router.param('productId', validateIdParam);

// Endpoint GET: Consultar todas las recetas del sistema (cualquier usuario autenticado)
router.get('/', (req, res) => recipeController.getRecipes(req, res));

// Endpoint GET: Obtener la receta asociada a un ID de producto (cualquier usuario autenticado)
router.get('/product/:productId', (req, res) => recipeController.getRecipeByProduct(req, res));

// Endpoint POST: Crear o actualizar la formulación/receta de un producto (solo ADMIN)
router.post('/', requireRole('ADMIN'), (req, res) => recipeController.saveRecipe(req, res));

// Endpoint DELETE: Eliminar la receta de un producto por ID (solo ADMIN)
router.delete('/:id', requireRole('ADMIN'), (req, res) => recipeController.deleteRecipe(req, res));

export default router;
