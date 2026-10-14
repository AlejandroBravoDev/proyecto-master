/**
 * ====================================================
 * SERVICIO DE RECETAS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona la lista de ingredientes y cantidades requeridas por producto.
 */

import prisma from '../prisma/client';
import { DbClient } from '../utils/sequence.utils';
import { RecipeIngredientInput } from '../utils/recipe.utils';

export class RecipeService {
  /**
   * Obtiene todas las recetas con sus insumos y detalles asociados.
   */
  async getAllRecipes() {
    return prisma.recipe.findMany({
      include: {
        product: true,
        recipeDetails: {
          include: { ingredient: true }
        }
      }
    });
  }

  /**
   * Busca la receta asignada a un producto específico.
   * @param productId ID del producto
   */
  async getRecipeByProduct(productId: number) {
    return prisma.recipe.findUnique({
      where: { productId },
      include: {
        product: true,
        recipeDetails: {
          include: { ingredient: true }
        }
      }
    });
  }

  /**
   * Convierte los insumos validados en filas de detalle de receta, comprobando que existan.
   * Si un renglón no trae unidad de medida usa la del propio insumo.
   * Lanza `INGREDIENT_NOT_FOUND:<id>` con el primer insumo inexistente.
   * @param db Cliente de Prisma (o de la transacción en curso)
   * @param ingredients Insumos ya validados con `parseRecipeIngredients`
   */
  async buildRecipeDetails(db: DbClient, ingredients: RecipeIngredientInput[]) {
    const found = await db.ingredient.findMany({
      where: { id: { in: ingredients.map((ing) => ing.ingredientId) } },
      select: { id: true, measurementUnit: true }
    });
    const unitById = new Map(found.map((ing) => [ing.id, ing.measurementUnit]));

    return ingredients.map((ing) => {
      const defaultUnit = unitById.get(ing.ingredientId);
      if (defaultUnit === undefined) {
        throw new Error(`INGREDIENT_NOT_FOUND:${ing.ingredientId}`);
      }
      return {
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        measurementUnit: ing.measurementUnit ?? defaultUnit
      };
    });
  }

  /**
   * Crea o REEMPLAZA (upsert) la receta de un producto con sus ingredientes y proporciones.
   * Todo ocurre en una transacción: si algo falla, la receta anterior queda intacta.
   * Una lista vacía deja la receta sin insumos (el producto no descontará stock).
   * @param data ID del producto y arreglo de ingredientes con su cantidad (ya validados)
   */
  async saveRecipe(data: {
    productId: number;
    name?: string;
    ingredients: RecipeIngredientInput[];
  }) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const details = await this.buildRecipeDetails(tx, data.ingredients);
      const existingRecipe = await tx.recipe.findUnique({ where: { productId: data.productId } });

      // Si ya existe una receta para el producto, reemplazar los detalles existentes
      if (existingRecipe) {
        await tx.recipeDetail.deleteMany({ where: { recipeId: existingRecipe.id } });

        return tx.recipe.update({
          where: { id: existingRecipe.id },
          data: {
            name: data.name || existingRecipe.name,
            recipeDetails: { create: details }
          },
          include: {
            recipeDetails: {
              include: { ingredient: true }
            }
          }
        });
      }

      // Si no existe, crear la receta desde cero
      return tx.recipe.create({
        data: {
          productId: data.productId,
          name: data.name || `Receta de ${product.name}`,
          recipeDetails: { create: details }
        },
        include: {
          recipeDetails: {
            include: { ingredient: true }
          }
        }
      });
    });
  }

  /**
   * Elimina una receta por su ID.
   * @param id ID de la receta
   */
  async deleteRecipe(id: number) {
    return prisma.recipe.delete({ where: { id } });
  }
}

export const recipeService = new RecipeService();
