/**
 * ====================================================
 * SERVICIO DE PRODUCTOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el catálogo de productos (preparados o de venta directa),
 * sus precios y la creación/consulta de sus recetas asociadas.
 */

import prisma from '../prisma/client';
import { RecipeIngredientInput } from '../utils/recipe.utils';
import { recipeService } from './recipe.service';

export class ProductService {
  /**
   * Consulta productos aplicando filtros opcionales (categoría, disponibilidad, tipo).
   * @param filters Filtros de búsqueda opcionales
   */
  async getProducts(filters?: { categoryId?: number; available?: boolean; productType?: string }) {
    // Construcción dinámica de la cláusula de búsqueda WHERE
    const whereClause: any = {};
    if (filters?.categoryId) whereClause.categoryId = filters.categoryId;
    if (filters?.available !== undefined) whereClause.available = filters.available;
    if (filters?.productType) whereClause.productType = filters.productType;

    return prisma.product.findMany({
      where: whereClause,
      include: {
        category: true, // Incluye la información de la categoría
        recipe: {
          include: {
            recipeDetails: {
              include: { ingredient: true } // Incluye la receta completa con insumos
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Obtiene la información detallada de un producto por su ID.
   * @param id ID único del producto
   */
  async getProductById(id: number) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        recipe: {
          include: {
            recipeDetails: {
              include: { ingredient: true }
            }
          }
        }
      }
    });
  }

  /**
   * Crea un producto y opcionalmente su receta asociada de forma atómica.
   * Lanza `CATEGORY_NOT_FOUND` o `INGREDIENT_NOT_FOUND:<id>` si la categoría o algún insumo no existen.
   * @param data Datos del producto y lista de ingredientes para la receta (ya validados)
   */
  async createProduct(data: {
    categoryId: number;
    name: string;
    description?: string | null;
    salePrice: number;
    image?: string | null;
    available?: boolean;
    productType?: 'PREPARED' | 'DIRECT_INVENTORY';
    recipe?: {
      name?: string;
      ingredients: RecipeIngredientInput[];
    };
  }) {
    return prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      const hasRecipe = data.recipe && data.recipe.ingredients.length > 0;
      const recipeDetails = hasRecipe
        ? await recipeService.buildRecipeDetails(tx, data.recipe!.ingredients)
        : [];

      return tx.product.create({
        data: {
          categoryId: data.categoryId,
          name: data.name,
          description: data.description,
          salePrice: data.salePrice,
          image: data.image,
          available: data.available !== undefined ? data.available : true,
          productType: data.productType || 'PREPARED',
          // Creación anidada opcional de receta en la misma transacción
          recipe: hasRecipe ? {
            create: {
              name: data.recipe!.name || `Receta de ${data.name}`,
              recipeDetails: { create: recipeDetails }
            }
          } : undefined
        },
        include: {
          category: true,
          recipe: {
            include: {
              recipeDetails: {
                include: { ingredient: true }
              }
            }
          }
        }
      });
    });
  }

  /**
   * Actualiza los datos de un producto.
   * `description` e `image` aceptan `null` para limpiar el campo.
   * Lanza `CATEGORY_NOT_FOUND` si se cambia a una categoría inexistente.
   * @param id ID del producto
   * @param data Campos modificables del producto
   */
  async updateProduct(id: number, data: Partial<{
    categoryId: number;
    name: string;
    description: string | null;
    salePrice: number;
    image: string | null;
    available: boolean;
    productType: 'PREPARED' | 'DIRECT_INVENTORY';
  }>) {
    if (data.categoryId !== undefined) {
      const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }
    }

    return prisma.product.update({
      where: { id },
      data,
      include: {
        category: true,
        recipe: {
          include: {
            recipeDetails: {
              include: { ingredient: true }
            }
          }
        }
      }
    });
  }

  /**
   * Elimina un producto junto con su receta, dentro de una transacción atómica.
   * Un producto con historial (comandas o ventas) NO se elimina: se perdería el detalle de
   * esos documentos y los totales dejarían de cuadrar; lanza `PRODUCT_HAS_HISTORY` y el
   * producto debe desactivarse (`available = false`) en su lugar.
   * @param id ID del producto
   */
  async deleteProduct(id: number) {
    return prisma.$transaction(async (tx) => {
      // 1. Rechazar si tiene historial de comandas o ventas
      const [orderLines, saleLines] = await Promise.all([
        tx.orderDetail.count({ where: { productId: id } }),
        tx.saleDetail.count({ where: { productId: id } })
      ]);
      if (orderLines > 0 || saleLines > 0) {
        throw new Error('PRODUCT_HAS_HISTORY');
      }

      // 2. Eliminar receta asociada y sus detalles si existen
      const recipe = await tx.recipe.findUnique({ where: { productId: id } });
      if (recipe) {
        await tx.recipeDetail.deleteMany({ where: { recipeId: recipe.id } });
        await tx.recipe.delete({ where: { id: recipe.id } });
      }

      // 3. Eliminar el producto (P2025 si no existe)
      return tx.product.delete({
        where: { id }
      });
    });
  }
}

export const productService = new ProductService();
