/**
 * ====================================================
 * SERVICIO DE INSUMOS E INVENTARIO (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona las materias primas en bodega, el control de stock,
 * alertas de nivel crítico, registros de movimientos manuales,
 * exportación / generación de plantillas y carga masiva desde Excel.
 */

import prisma from '../prisma/client';
import ExcelJS from 'exceljs';

/** Máximo de filas de datos que se procesan en una sola carga masiva. */
export const MAX_IMPORT_ROWS = 5000;

/** Encabezados de la plantilla de carga, en el orden fijo de sus columnas (ya normalizados). */
const IMPORT_HEADERS = ['nombre del insumo', 'descripcion', 'unidad de medida', 'stock inicial', 'stock minimo', 'costo unitario'];

/** Texto de una celda ya recortado (cell.text resuelve fórmulas, texto enriquecido y números). */
const cellText = (cell: ExcelJS.Cell): string => String(cell.text ?? '').trim();

/** Normaliza un encabezado: minúsculas, sin tildes, sin marcas "(*)" / "($)" y sin espacios sobrantes. */
const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\(\s*[*$]\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Interpreta una celda numérica de la plantilla: vacía = no informada (undefined);
 * texto no numérico o negativo = motivo de error para esa fila.
 */
const parseNonNegative = (text: string, label: string): { value?: number; error?: string } => {
  if (text === '') return {};
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: `${label} no es un número válido` };
  if (value < 0) return { error: `${label} no puede ser negativo` };
  return { value };
};

export class IngredientService {
  /**
   * Obtiene todos los insumos ordenados alfabéticamente con filtro opcional por nombre o descripción.
   * @param searchTerm Término de búsqueda opcional
   */
  async getAllIngredients(searchTerm?: string) {
    const where = searchTerm && searchTerm.trim() ? {
      OR: [
        { name: { contains: searchTerm.trim() } },
        { description: { contains: searchTerm.trim() } }
      ]
    } : undefined;

    return prisma.ingredient.findMany({
      where,
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
   * Elimina un insumo del catálogo eliminando previamente sus movimientos de inventario (Kardex)
   * y sus asociaciones en recetas de manera atómica para evitar errores de claves foráneas (P2003).
   * @param id ID del insumo
   */
  async deleteIngredient(id: number) {
    return prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.deleteMany({ where: { ingredientId: id } });
      await tx.recipeDetail.deleteMany({ where: { ingredientId: id } });
      return tx.ingredient.delete({ where: { id } });
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
      fgColor: { argb: '584235' }
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

      if (isCritical) {
        row.getCell('status').font = { color: { argb: 'DC2626' }, bold: true };
      }
    }

    return workbook;
  }

  /**
   * Importa de forma masiva insumos desde un archivo de Excel (Buffer).
   * Si un insumo ya existe por su nombre, actualiza sus campos; si no existe, lo crea.
   * Las filas se procesan una a una (cada una en su transacción, junto con su movimiento de Kardex) y el
   * resumen se devuelve solo cuando todas terminaron.
   * En un insumo existente, "Stock Inicial" es el stock resultante: si difiere del actual se registra un
   * movimiento IN/OUT (MANUAL_ADJUSTMENT) con la diferencia.
   * Una celda numérica vacía cuenta como "no informada": en un insumo existente conserva su valor actual.
   * @param buffer Buffer binario del archivo .xlsx subido
   */
  async importIngredientsFromExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any); // exceljs tipa Buffer con una definición antigua
    } catch {
      throw new Error('INVALID_XLSX_FILE');
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('NO_WORKSHEET_FOUND');
    }

    // Rechazar archivos que no son la plantilla: las columnas se leen por posición
    const headerRow = worksheet.getRow(1);
    const isTemplate = IMPORT_HEADERS.every(
      (expected, index) => normalizeHeader(cellText(headerRow.getCell(index + 1))) === expected
    );
    if (!isTemplate) {
      throw new Error('INVALID_TEMPLATE');
    }

    // 1) Recolectar las filas. eachRow es SÍNCRONO: nunca uses async/await dentro de su callback.
    const rows: Array<{
      rowNumber: number;
      name: string;
      description: string;
      measurementUnit: string;
      currentStock: string;
      minimumStock: string;
      unitCost: string;
    }> = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // encabezado
      rows.push({
        rowNumber,
        name: cellText(row.getCell(1)),
        description: cellText(row.getCell(2)),
        measurementUnit: cellText(row.getCell(3)),
        currentStock: cellText(row.getCell(4)),
        minimumStock: cellText(row.getCell(5)),
        unitCost: cellText(row.getCell(6))
      });
    });

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error('TOO_MANY_ROWS');
    }

    // 2) Procesar en secuencia esperando cada fila: un error en una fila no aborta el lote
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const r of rows) {
      // Omitir filas sin los campos obligatorios (nombre y unidad de medida)
      if (!r.name || !r.measurementUnit) {
        results.skipped++;
        continue;
      }

      const stock = parseNonNegative(r.currentStock, 'Stock Inicial');
      const minimum = parseNonNegative(r.minimumStock, 'Stock Mínimo');
      const cost = parseNonNegative(r.unitCost, 'Costo Unitario');
      const invalidReason = stock.error ?? minimum.error ?? cost.error;
      if (invalidReason) {
        results.errors.push(`Fila ${r.rowNumber} (${r.name}): ${invalidReason}`);
        continue;
      }

      try {
        // Cada fila es atómica: el insumo y su movimiento de Kardex se guardan juntos o no se guarda nada
        const outcome = await prisma.$transaction(async (tx) => {
          const existing = await tx.ingredient.findUnique({
            where: { name: r.name }
          });

          if (existing) {
            // Si existe, actualizar sus datos. El stock anterior es el leído dentro de la transacción;
            // la diferencia se redondea para ignorar el ruido de coma flotante (p. ej. 9.549999999999999 vs 9.55).
            const requestedStock = stock.value ?? existing.currentStock;
            const delta = Number((requestedStock - existing.currentStock).toFixed(6));
            const newStock = delta !== 0 ? requestedStock : existing.currentStock;

            await tx.ingredient.update({
              where: { id: existing.id },
              data: {
                description: r.description || existing.description,
                measurementUnit: r.measurementUnit,
                currentStock: newStock,
                minimumStock: minimum.value ?? existing.minimumStock,
                unitCost: cost.value ?? existing.unitCost
              }
            });

            // Todo cambio de stock deja su movimiento en el Kardex (ajuste por inventario del archivo)
            if (delta !== 0) {
              await tx.inventoryMovement.create({
                data: {
                  ingredientId: existing.id,
                  type: delta > 0 ? 'IN' : 'OUT',
                  reason: 'MANUAL_ADJUSTMENT',
                  quantity: Math.abs(delta),
                  previousStock: existing.currentStock,
                  newStock,
                  reference: 'Bulk Excel Import'
                }
              });
            }

            return 'updated' as const;
          }

          // Si no existe, crearlo y registrar Kardex inicial si stock > 0
          const newIngredient = await tx.ingredient.create({
            data: {
              name: r.name,
              description: r.description || undefined,
              measurementUnit: r.measurementUnit,
              currentStock: stock.value ?? 0,
              minimumStock: minimum.value ?? 0,
              unitCost: cost.value ?? 0
            }
          });

          if (newIngredient.currentStock > 0) {
            await tx.inventoryMovement.create({
              data: {
                ingredientId: newIngredient.id,
                type: 'IN',
                reason: 'PURCHASE',
                quantity: newIngredient.currentStock,
                previousStock: 0,
                newStock: newIngredient.currentStock,
                reference: 'Bulk Excel Import'
              }
            });
          }

          return 'created' as const;
        });

        results[outcome]++;
      } catch (err: any) {
        console.error(`[Importación Excel] Fila ${r.rowNumber} (${r.name}):`, err);
        const reason = err?.code === 'P2002' ? 'registro duplicado' : 'error al procesar la fila';
        results.errors.push(`Fila ${r.rowNumber} (${r.name}): ${reason}`);
      }
    }

    return results;
  }
}

export const ingredientService = new IngredientService();
