/**
 * ====================================================
 * SERVICIO DE INSUMOS E INVENTARIO (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona las materias primas en bodega, el control de stock,
 * alertas de nivel crítico, registros de movimientos manuales
 * y exportación / generación de plantillas Excel.
 */

import prisma from '../prisma/client';
import ExcelJS from 'exceljs';

export class IngredientService {
  /**
   * Obtiene todos los insumos ordenados alfabéticamente.
   */
  async getAllIngredients() {
    return prisma.ingredient.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Obtiene la información de un insumo específico y sus últimos 20 movimientos.
   * @param id ID único del insumo
   */
  async getIngredientById(id: number) {
    return prisma.ingredient.findUnique({
      where: { id },
      include: {
        inventoryMovements: {
          take: 20,
          orderBy: { date: 'desc' }
        }
      }
    });
  }

  /**
   * Registra un nuevo insumo y genera el movimiento inicial de inventario si el stock es mayor a 0.
   * @param data Datos del insumo (nombre, unidad de medida, stock inicial, etc.)
   */
  async createIngredient(data: {
    name: string;
    description?: string;
    measurementUnit: string;
    currentStock?: number;
    minimumStock?: number;
    unitCost?: number;
  }) {
    const ingredient = await prisma.ingredient.create({
      data: {
        name: data.name,
        description: data.description,
        measurementUnit: data.measurementUnit,
        currentStock: data.currentStock || 0,
        minimumStock: data.minimumStock || 0,
        unitCost: data.unitCost || 0
      }
    });

    // Si se especificó un stock inicial mayor a 0, registrar movimiento inicial en Kardex
    if (ingredient.currentStock > 0) {
      await prisma.inventoryMovement.create({
        data: {
          ingredientId: ingredient.id,
          type: 'IN',
          reason: 'PURCHASE',
          quantity: ingredient.currentStock,
          previousStock: 0,
          newStock: ingredient.currentStock,
          reference: 'Initial Stock'
        }
      });
    }

    return ingredient;
  }

  /**
   * Actualiza la información de un insumo o realiza un ajuste manual de stock acumulado.
   * @param id ID del insumo
   * @param data Datos a actualizar y ajuste opcional de stock
   */
  async updateIngredient(id: number, data: {
    name?: string;
    description?: string;
    measurementUnit?: string;
    minimumStock?: number;
    unitCost?: number;
    active?: boolean;
    adjustStock?: number;
    adjustReason?: 'PURCHASE' | 'SALE' | 'WASTE' | 'MANUAL_ADJUSTMENT';
  }) {
    const existing = await prisma.ingredient.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('INGREDIENT_NOT_FOUND');
    }

    let newStock = existing.currentStock;

    // Procesar ajuste de stock manual si se especificó la cantidad
    if (data.adjustStock !== undefined && data.adjustStock !== null) {
      const adjustmentQty = Number(data.adjustStock);
      newStock = existing.currentStock + adjustmentQty;

      // Validación: El stock en bodega no puede quedar en valores negativos
      if (newStock < 0) {
        throw new Error('STOCK_CANNOT_BE_NEGATIVE');
      }

      // Registrar la entrada o salida en el historial de Kardex
      await prisma.inventoryMovement.create({
        data: {
          ingredientId: id,
          type: adjustmentQty >= 0 ? 'IN' : 'OUT',
          reason: data.adjustReason || 'MANUAL_ADJUSTMENT',
          quantity: Math.abs(adjustmentQty),
          previousStock: existing.currentStock,
          newStock: newStock,
          reference: 'Manual Adjustment'
        }
      });
    }

    return prisma.ingredient.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        measurementUnit: data.measurementUnit !== undefined ? data.measurementUnit : existing.measurementUnit,
        minimumStock: data.minimumStock !== undefined ? data.minimumStock : existing.minimumStock,
        unitCost: data.unitCost !== undefined ? data.unitCost : existing.unitCost,
        active: data.active !== undefined ? data.active : existing.active,
        currentStock: newStock
      }
    });
  }

  /**
   * Elimina un insumo del catálogo.
   * @param id ID del insumo
   */
  async deleteIngredient(id: number) {
    return prisma.ingredient.delete({
      where: { id }
    });
  }

  /**
   * Genera el libro de Excel con la plantilla para la carga masiva de insumos.
   */
  async generateIngredientsTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Plantilla Insumos');

    // Definición de columnas
    worksheet.columns = [
      { header: 'Nombre del Insumo (*)', key: 'name', width: 30 },
      { header: 'Descripción', key: 'description', width: 40 },
      { header: 'Unidad de Medida (*)', key: 'measurementUnit', width: 20 },
      { header: 'Stock Inicial', key: 'currentStock', width: 15 },
      { header: 'Stock Mínimo', key: 'minimumStock', width: 15 },
      { header: 'Costo Unitario ($)', key: 'unitCost', width: 18 }
    ];

    // Estilar encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '584235' } // Color temático marrón/brand
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Ejemplos de guía en la plantilla
    worksheet.addRow({
      name: 'Carne de Res 150g',
      description: 'Porciones de carne para hamburguesa',
      measurementUnit: 'unidad',
      currentStock: 50,
      minimumStock: 10,
      unitCost: 2.50
    });

    worksheet.addRow({
      name: 'Pan de Hamburguesa',
      description: 'Pan artesanal brioche',
      measurementUnit: 'unidad',
      currentStock: 100,
      minimumStock: 20,
      unitCost: 0.60
    });

    return workbook;
  }

  /**
   * Genera el libro de Excel con el reporte actual de inventarios.
   */
  async exportIngredientsToExcel(): Promise<ExcelJS.Workbook> {
    const ingredients = await this.getAllIngredients();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reporte Inventario');

    // Definición de columnas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre del Insumo', key: 'name', width: 30 },
      { header: 'Descripción', key: 'description', width: 35 },
      { header: 'Unidad de Medida', key: 'measurementUnit', width: 18 },
      { header: 'Stock Actual', key: 'currentStock', width: 15 },
      { header: 'Stock Mínimo', key: 'minimumStock', width: 15 },
      { header: 'Costo Unitario', key: 'unitCost', width: 15 },
      { header: 'Valor Total Stock', key: 'totalValue', width: 18 },
      { header: 'Estado Stock', key: 'status', width: 18 }
    ];

    // Estilar encabezados
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E293B' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Agregar filas de datos
    for (const ing of ingredients) {
      const totalValue = Number((ing.currentStock * ing.unitCost).toFixed(2));
      const isCritical = ing.currentStock <= ing.minimumStock;
      const statusText = isCritical ? 'ALERTA / CRÍTICO' : 'NORMAL';

      const row = worksheet.addRow({
        id: ing.id,
        name: ing.name,
        description: ing.description || '-',
        measurementUnit: ing.measurementUnit,
        currentStock: ing.currentStock,
        minimumStock: ing.minimumStock,
        unitCost: ing.unitCost,
        totalValue,
        status: statusText
      });

      // Resaltar en rojo claro filas con stock crítico
      if (isCritical) {
        row.getCell('status').font = { color: { argb: 'DC2626' }, bold: true };
      }
    }

    return workbook;
  }
}

export const ingredientService = new IngredientService();
