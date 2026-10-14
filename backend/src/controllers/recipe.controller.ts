/**
 * ====================================================
 * CONTROLADOR DE RECETAS (CONTROLLER LAYER)
 * ====================================================
 * Administra las peticiones para la formulación de productos.
 */

import { Request, Response } from 'express';
import { recipeService } from '../services/recipe.service';
import { errorDetails, parseId, parseOptionalText } from '../utils/http.utils';
import { parseRecipeIngredients } from '../utils/recipe.utils';

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
      return res.status(500).json({ error: 'Error al obtener recetas', details: errorDetails(error) });
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
      return res.status(500).json({ error: 'Error al obtener la receta', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/recipes
   * Crea o REEMPLAZA la receta de un producto (upsert por productId): la lista de insumos
   * enviada sustituye por completo a la anterior.
   */
  async saveRecipe(req: Request, res: Response) {
    try {
      const { productId, name, ingredients } = req.body ?? {};

      const parsedProductId = parseId(productId);
      if (parsedProductId === null || !Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'productId (entero positivo) e ingredients (arreglo) son obligatorios' });
      }

      const parsedIngredients = parseRecipeIngredients(ingredients);
      if ('error' in parsedIngredients) {
        return res.status(400).json({ error: parsedIngredients.error });
      }

      const parsedName = parseOptionalText(name);
      if (!parsedName.valid) {
        return res.status(400).json({ error: 'El nombre de la receta debe ser texto' });
      }

      const recipe = await recipeService.saveRecipe({
        productId: parsedProductId,
        name: parsedName.value ?? undefined,
        ingredients: parsedIngredients.ingredients
      });

      return res.status(201).json(recipe);
    } catch (error: any) {
      if (error.message === 'PRODUCT_NOT_FOUND') {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      if (error.message?.startsWith('INGREDIENT_NOT_FOUND:')) {
        return res.status(400).json({ error: `El insumo con ID ${error.message.split(':')[1]} no existe` });
      }
      return res.status(500).json({ error: 'Error al guardar la receta', details: errorDetails(error) });
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
      return res.status(500).json({ error: 'Error al eliminar la receta', details: errorDetails(error) });
    }
  }
}

export const recipeController = new RecipeController();
