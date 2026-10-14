/**
 * ====================================================
 * CONTROLADOR DE CATEGORÍAS (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP (req) para categorías,
 * invoca la capa de servicios y responde con JSON (res).
 */

import { Request, Response } from 'express';
import { categoryService } from '../services/category.service';
import { errorDetails, parseOptionalText, parseRequiredText } from '../utils/http.utils';

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
      return res.status(500).json({ error: 'Error al obtener categorías', details: errorDetails(error) });
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
      return res.status(500).json({ error: 'Error al obtener la categoría', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/categories
   * Valida la entrada y registra una nueva categoría.
   */
  async createCategory(req: Request, res: Response) {
    try {
      const { name, description } = req.body ?? {};

      const trimmedName = parseRequiredText(name);
      if (trimmedName === null) {
        return res.status(400).json({ error: 'El nombre de la categoría es obligatorio' });
      }

      const parsedDescription = parseOptionalText(description);
      if (!parsedDescription.valid) {
        return res.status(400).json({ error: 'La descripción de la categoría debe ser texto' });
      }

      const category = await categoryService.createCategory({ name: trimmedName, description: parsedDescription.value });
      return res.status(201).json(category);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe una categoría con este nombre' });
      }
      return res.status(500).json({ error: 'Error al crear la categoría', details: errorDetails(error) });
    }
  }

  /**
   * PUT /api/categories/:id
   * Modifica la información de una categoría existente.
   * `description: null` (o texto vacío) limpia la descripción.
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name, description } = req.body ?? {};

      const data: { name?: string; description?: string | null } = {};

      if (name !== undefined) {
        const trimmedName = parseRequiredText(name);
        if (trimmedName === null) {
          return res.status(400).json({ error: 'El nombre de la categoría no puede estar vacío' });
        }
        data.name = trimmedName;
      }

      const parsedDescription = parseOptionalText(description);
      if (!parsedDescription.valid) {
        return res.status(400).json({ error: 'La descripción de la categoría debe ser texto' });
      }
      if (parsedDescription.value !== undefined) {
        data.description = parsedDescription.value;
      }

      const category = await categoryService.updateCategory(id, data);
      return res.json(category);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe una categoría con este nombre' });
      }
      return res.status(500).json({ error: 'Error al actualizar la categoría', details: errorDetails(error) });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Elimina una categoría por su identificador (400 si todavía tiene productos).
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await categoryService.deleteCategory(id);
      return res.json({ message: 'Categoría eliminada correctamente' });
    } catch (error: any) {
      if (error.message === 'CATEGORY_NOT_FOUND' || error.code === 'P2025') {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      if (error.message?.startsWith('CATEGORY_HAS_PRODUCTS:')) {
        const count = Number(error.message.split(':')[1]);
        return res.status(400).json({
          error: `No se puede eliminar la categoría porque tiene ${count} ${count === 1 ? 'producto asociado' : 'productos asociados'}. Mueve o elimina esos productos primero.`
        });
      }
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'No se puede eliminar la categoría porque tiene productos asociados. Mueve o elimina esos productos primero.' });
      }
      return res.status(500).json({ error: 'Error al eliminar la categoría', details: errorDetails(error) });
    }
  }
}

export const categoryController = new CategoryController();
