/**
 * ====================================================
 * CONTROLADOR DE CATEGORÍAS (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP (req) para categorías,
 * invoca la capa de servicios y responde con JSON (res).
 */

import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';

export class CategoryController {
  /**
   * GET /api/categories
   * Obtiene y retorna todas las categorías registradas.
   */
  async getCategories(_req: Request, res: Response) {
    try {
      const categories = await categoryService.getAllCategories();
      return res.json(categories);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener categorías', details: error });
    }
  }

  /**
   * GET /api/categories/:id
   * Obtiene los detalles de una categoría por su ID.
   */
  async getCategoryById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      return res.json(category);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener la categoría', details: error });
    }
  }

  /**
   * POST /api/categories
   * Valida la entrada y registra una nueva categoría.
   */
  async createCategory(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
      }

      const category = await categoryService.createCategory({ name, description });
      return res.status(201).json(category);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe una categoría con este nombre' });
      }
      return res.status(500).json({ error: 'Error al crear la categoría', details: error });
    }
  }

  /**
   * PUT /api/categories/:id
   * Modifica la información de una categoría existente.
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name, description } = req.body;

      const category = await categoryService.updateCategory(id, { name, description });
      return res.json(category);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      return res.status(500).json({ error: 'Error al actualizar la categoría', details: error });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Elimina una categoría por su identificador.
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await categoryService.deleteCategory(id);
      return res.json({ message: 'Categoría eliminada correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      return res.status(500).json({ error: 'Error al eliminar la categoría', details: error });
    }
  }
}

export const categoryController = new CategoryController();
