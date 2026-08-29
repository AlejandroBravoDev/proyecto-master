/**
 * ====================================================
 * CONTROLADOR DE INSUMOS E INVENTARIO (CONTROLLER LAYER)
 * ====================================================
 * Procesa peticiones para la administración de stock de materias primas
 * y la exportación/descarga de plantillas en Excel.
 */

import { Request, Response } from 'express';
import { ingredientService } from '../services/ingredient.service';

export class IngredientController {
  /**
   * GET /api/ingredients
   * Retorna el listado completo de insumos.
   */
  async getIngredients(_req: Request, res: Response) {
    try {
      const ingredients = await ingredientService.getAllIngredients();
      return res.json(ingredients);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener los insumos', details: error });
    }
  }

  /**
   * GET /api/ingredients/template/ingredients
   * Descarga la plantilla de Excel para la carga masiva de insumos.
   */
  async downloadTemplate(_req: Request, res: Response) {
    try {
      const workbook = await ingredientService.generateIngredientsTemplate();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="plantilla_carga_ingredientes.xlsx"'
      );

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error) {
      return res.status(500).json({ error: 'Error al generar la plantilla de Excel', details: error });
    }
  }

  /**
   * GET /api/ingredients/export/ingredients
   * Descarga el reporte de inventario de insumos en formato Excel.
   */
  async exportExcel(_req: Request, res: Response) {
    try {
      const workbook = await ingredientService.exportIngredientsToExcel();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="reporte_inventario_ingredientes.xlsx"'
      );

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error) {
      return res.status(500).json({ error: 'Error al exportar el reporte a Excel', details: error });
    }
  }

  /**
   * GET /api/ingredients/:id
   * Retorna la información de un insumo y su historial de movimientos.
   */
  async getIngredientById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const ingredient = await ingredientService.getIngredientById(id);

      if (!ingredient) {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      return res.json(ingredient);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener el insumo', details: error });
    }
  }

  /**
   * POST /api/ingredients
   * Registra un nuevo insumo en bodega.
   */
  async createIngredient(req: Request, res: Response) {
    try {
      const { name, description, measurementUnit, currentStock, minimumStock, unitCost } = req.body;

      if (!name || !measurementUnit) {
        return res.status(400).json({ error: 'Nombre y unidad de medida son requeridos' });
      }

      const ingredient = await ingredientService.createIngredient({
        name,
        description,
        measurementUnit,
        currentStock: currentStock ? Number(currentStock) : undefined,
        minimumStock: minimumStock ? Number(minimumStock) : undefined,
        unitCost: unitCost ? Number(unitCost) : undefined
      });

      return res.status(201).json(ingredient);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe un insumo con este nombre' });
      }
      return res.status(500).json({ error: 'Error al crear el insumo', details: error });
    }
  }

  /**
   * PUT /api/ingredients/:id
   * Modifica propiedades o procesa un ajuste manual de inventario.
   */
  async updateIngredient(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name, description, measurementUnit, minimumStock, unitCost, active, adjustStock, adjustReason } = req.body;

      const updated = await ingredientService.updateIngredient(id, {
        name,
        description,
        measurementUnit,
        minimumStock: minimumStock !== undefined ? Number(minimumStock) : undefined,
        unitCost: unitCost !== undefined ? Number(unitCost) : undefined,
        active: active !== undefined ? Boolean(active) : undefined,
        adjustStock: adjustStock !== undefined ? Number(adjustStock) : undefined,
        adjustReason
      });

      return res.json(updated);
    } catch (error: any) {
      if (error.message === 'INGREDIENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
      if (error.message === 'STOCK_CANNOT_BE_NEGATIVE') {
        return res.status(400).json({ error: 'El stock no puede quedar en negativo' });
      }
      return res.status(500).json({ error: 'Error al actualizar el insumo', details: error });
    }
  }

  /**
   * DELETE /api/ingredients/:id
   * Elimina un insumo.
   */
  async deleteIngredient(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      await ingredientService.deleteIngredient(id);
      return res.json({ message: 'Insumo eliminado correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
      return res.status(500).json({ error: 'Error al eliminar el insumo', details: error });
    }
  }
}

export const ingredientController = new IngredientController();
