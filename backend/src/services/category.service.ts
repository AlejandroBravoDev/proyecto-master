/**
 * ====================================================
 * SERVICIO DE CATEGORÍAS (MODEL/SERVICE LAYER)
 * ====================================================
 * Contiene la lógica de interacción con la base de datos
 * para la gestión de las categorías de productos.
 */

import prisma from '../prisma/client';

export class CategoryService {
  /**
   * Obtiene la lista completa de categorías ordenadas alfabéticamente.
   * Incluye el conteo total de productos asociados a cada categoría.
   */
  async getAllCategories() {
    return prisma.category.findMany({
      include: {
        _count: {
          select: { products: true } // Cuenta la cantidad de productos por categoría
        }
      },
      orderBy: { name: 'asc' } // Orden alfabético ascendente
    });
  }

  /**
   * Obtiene una categoría específica por su identificador único.
   * @param id ID numérico de la categoría
   */
  async getCategoryById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: { products: true } // Incluye la lista de productos pertenecientes a la categoría
    });
  }

  /**
   * Registra una nueva categoría en la base de datos.
   * @param data Objeto con el nombre y descripción opcional
   */
  async createCategory(data: { name: string; description?: string }) {
    return prisma.category.create({ data });
  }

  /**
   * Actualiza los datos de una categoría existente.
   * @param id ID de la categoría a modificar
   * @param data Campos a actualizar (nombre, descripción)
   */
  async updateCategory(id: number, data: { name?: string; description?: string }) {
    return prisma.category.update({
      where: { id },
      data
    });
  }

  /**
   * Elimina una categoría de la base de datos.
   * @param id ID de la categoría a eliminar
   */
  async deleteCategory(id: number) {
    return prisma.category.delete({
      where: { id }
    });
  }
}

// Exportar una única instancia reutilizable del servicio
export const categoryService = new CategoryService();
