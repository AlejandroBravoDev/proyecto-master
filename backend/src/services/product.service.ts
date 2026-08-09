/**
 * ====================================================
 * SERVICIO DE PRODUCTOS (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el catálogo de productos (preparados o de venta directa),
 * sus precios y la creación/consulta de sus recetas asociadas.
 */

import prisma from '../prisma/client';

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
   * @param data Datos del producto y lista de ingredientes para la receta
   */
  async createProduct(data: {
    categoryId: number;
    name: string;
    description?: string;
    salePrice: number;
    image?: string;
    available?: boolean;
    productType?: 'PREPARED' | 'DIRECT_INVENTORY';
    recipe?: {
      name?: string;
      ingredients: Array<{ ingredientId: number; quantity: number; measurementUnit: string }>;
    };
  }) {
    return prisma.product.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        salePrice: data.salePrice,
        image: data.image,
        available: data.available !== undefined ? data.available : true,
        productType: data.productType || 'PREPARED',
        // Creación anidada opcional de receta en la misma transacción
        recipe: data.recipe && data.recipe.ingredients && data.recipe.ingredients.length > 0 ? {
          create: {
            name: data.recipe.name || `Receta de ${data.name}`,
            recipeDetails: {
              create: data.recipe.ingredients.map((ing) => ({
                ingredientId: Number(ing.ingredientId),
                quantity: Number(ing.quantity),
                measurementUnit: String(ing.measurementUnit)
              }))
            }
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
  }

  /**
   * Actualiza los datos de un producto.
   * @param id ID del producto
   * @param data Campos modificables del producto
   */
  async updateProduct(id: number, data: Partial<{
    categoryId: number;
    name: string;
    description: string;
    salePrice: number;
    image: string;
    available: boolean;
    productType: 'PREPARED' | 'DIRECT_INVENTORY';
  }>) {
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
   * Elimina un producto por su ID.
   * @param id ID del producto
   */
  async deleteProduct(id: number) {
    return prisma.product.delete({
      where: { id }
    });
  }
}

export const productService = new ProductService();
