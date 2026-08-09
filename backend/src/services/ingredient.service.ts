/**
 * ====================================================
 * SERVICIO DE INSUMOS E INVENTARIO (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona las materias primas en bodega, el control de stock,
 * alertas de nivel crítico y registros de movimientos manuales.
 */

import prisma from '../prisma/client';

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
}

export const ingredientService = new IngredientService();
