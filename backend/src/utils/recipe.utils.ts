/**
 * ====================================================
 * VALIDACIÓN DE INGREDIENTES DE UNA RECETA
 * ====================================================
 * Compartida por POST /api/recipes y por la receta anidada de POST /api/products.
 */

import { parseId, toFiniteNumber } from './http.utils';

export interface RecipeIngredientInput {
  ingredientId: number;
  quantity: number;
  /** Si no se envía, el service usa la unidad del propio insumo. */
  measurementUnit?: string;
}

/**
 * Valida la lista de insumos de una receta: arreglo de objetos con `ingredientId` entero
 * positivo, `quantity` mayor que 0 y, opcionalmente, `measurementUnit` (texto); sin insumos repetidos.
 * Devuelve la lista normalizada o un mensaje de error en español para responder 400.
 */
export function parseRecipeIngredients(
  value: unknown
): { ingredients: RecipeIngredientInput[] } | { error: string } {
  if (!Array.isArray(value)) {
    return { error: 'ingredients debe ser un arreglo de insumos' };
  }

  const ingredients: RecipeIngredientInput[] = [];
  const seen = new Set<number>();

  for (const raw of value) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const ingredientId = parseId(item.ingredientId);
    const quantity = toFiniteNumber(item.quantity);

    if (ingredientId === null) {
      return { error: 'Cada insumo de la receta debe tener un ingredientId válido' };
    }
    if (quantity === null || quantity <= 0) {
      return { error: 'La cantidad de cada insumo de la receta debe ser un número mayor a 0' };
    }
    if (item.measurementUnit !== undefined && item.measurementUnit !== null
      && (typeof item.measurementUnit !== 'string' || item.measurementUnit.trim() === '')) {
      return { error: 'La unidad de medida de cada insumo de la receta debe ser un texto no vacío' };
    }
    if (seen.has(ingredientId)) {
      return { error: 'Un insumo no puede repetirse en la misma receta' };
    }
    seen.add(ingredientId);

    ingredients.push({
      ingredientId,
      quantity,
      measurementUnit: typeof item.measurementUnit === 'string' ? item.measurementUnit.trim() : undefined
    });
  }

  return { ingredients };
}
