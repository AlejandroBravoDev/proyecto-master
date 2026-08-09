/**
 * ====================================================
 * RUTAS DE RECETAS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de RecipeController.
 */

import { Router } from 'express';
import { recipeController } from '../controllers/recipe.controller';

const router = Router();

// Endpoint GET: Consultar todas las recetas del sistema
router.get('/', (req, res) => recipeController.getRecipes(req, res));

// Endpoint GET: Obtener la receta asociada a un ID de producto
router.get('/product/:productId', (req, res) => recipeController.getRecipeByProduct(req, res));

// Endpoint POST: Crear o actualizar la formulación/receta de un producto
router.post('/', (req, res) => recipeController.saveRecipe(req, res));

// Endpoint DELETE: Eliminar la receta de un producto por ID
router.delete('/:id', (req, res) => recipeController.deleteRecipe(req, res));

export default router;
