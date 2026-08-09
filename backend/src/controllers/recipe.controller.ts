/**
 * ====================================================
 * CONTROLADOR DE RECETAS (CONTROLLER LAYER)
 * ====================================================
 * Administra las peticiones para la formulación de productos.
 */

import { Request, Response } from 'express';
import { recipeService } from '../services/recipe.service';

export class RecipeController {
  /**
   * GET /api/recipes
   * Lista todas las recetas registradas.
   */
  async getRecipes(_req: Request, res: Response) {
    try {
      const recipes = await recipeService.getAllRecipes();
      return res.json(recipes);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener recetas', details: error });
    }
  }

  /**
   * GET /api/recipes/product/:productId
   * Obtiene la receta correspondiente a un producto específico.
   */
  async getRecipeByProduct(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      const recipe = await recipeService.getRecipeByProduct(productId);

      if (!recipe) {
        return res.status(404).json({ error: 'Receta no encontrada para este producto' });
      }

      return res.json(recipe);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener la receta', details: error });
    }
  }

  /**
   * POST /api/recipes
   * Crea o actualiza la lista de insumos de una receta.
   */
  async saveRecipe(req: Request, res: Response) {
    try {
      const { productId, name, ingredients } = req.body;

      if (!productId || !ingredients || !Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'productId e ingredients (arreglo) son obligatorios' });
      }

      const recipe = await recipeService.saveRecipe({
        productId: Number(productId),
        name,
        ingredients
      });

      return res.status(201).json(recipe);
    } catch (error: any) {
      if (error.message === 'PRODUCT_NOT_FOUND') {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      return res.status(500).json({ error: 'Error al guardar la receta', details: error });
    }
  }

  /**
   * DELETE /api/recipes/:id
   * Elimina una receta.
   */
  async deleteRecipe(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await recipeService.deleteRecipe(id);
      return res.json({ message: 'Receta eliminada correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Receta no encontrada' });
      }
      return res.status(500).json({ error: 'Error al eliminar la receta', details: error });
    }
  }
}

export const recipeController = new RecipeController();
