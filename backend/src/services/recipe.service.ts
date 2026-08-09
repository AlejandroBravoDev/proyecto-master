/**
 * ====================================================
 * SERVICIO DE RECETAS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona la lista de ingredientes y cantidades requeridas por producto.
 */

import prisma from '../prisma/client';

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
   * Crea o actualiza (Upsert) la receta de un producto con sus ingredientes y proporciones.
   * @param data ID del producto y arreglo de ingredientes con su cantidad
   */
  async saveRecipe(data: {
    productId: number;
    name?: string;
    ingredients: Array<{ ingredientId: number; quantity: number; measurementUnit: string }>;
  }) {
    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }

    const existingRecipe = await prisma.recipe.findUnique({ where: { productId: data.productId } });

    // Si ya existe una receta para el producto, reemplazar los detalles existentes
    if (existingRecipe) {
      await prisma.recipeDetail.deleteMany({ where: { recipeId: existingRecipe.id } });

      return prisma.recipe.update({
        where: { id: existingRecipe.id },
        data: {
          name: data.name || existingRecipe.name,
          recipeDetails: {
            create: data.ingredients.map((ing) => ({
              ingredientId: Number(ing.ingredientId),
              quantity: Number(ing.quantity),
              measurementUnit: String(ing.measurementUnit)
            }))
          }
        },
        include: {
          recipeDetails: {
            include: { ingredient: true }
          }
        }
      });
    }

    // Si no existe, crear la receta desde cero
    return prisma.recipe.create({
      data: {
        productId: data.productId,
        name: data.name || `Receta de ${product.name}`,
        recipeDetails: {
          create: data.ingredients.map((ing) => ({
            ingredientId: Number(ing.ingredientId),
            quantity: Number(ing.quantity),
            measurementUnit: String(ing.measurementUnit)
          }))
        }
      },
      include: {
        recipeDetails: {
          include: { ingredient: true }
        }
      }
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
