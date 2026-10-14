import { parseRecipeIngredients } from '../../src/utils/recipe.utils';

describe('parseRecipeIngredients', () => {
  it('normaliza una lista válida (ids y cantidades numéricas, unidad opcional recortada)', () => {
    const result = parseRecipeIngredients([
      { ingredientId: '3', quantity: '2.5', measurementUnit: ' kg ' },
      { ingredientId: 4, quantity: 1 },
    ]);
    expect(result).toEqual({
      ingredients: [
        { ingredientId: 3, quantity: 2.5, measurementUnit: 'kg' },
        { ingredientId: 4, quantity: 1, measurementUnit: undefined },
      ],
    });
  });

  it('acepta una lista vacía (receta sin insumos)', () => {
    expect(parseRecipeIngredients([])).toEqual({ ingredients: [] });
  });

  it.each([
    ['no es un arreglo', 'abc', /arreglo/],
    ['no es un arreglo (objeto)', { ingredientId: 1 }, /arreglo/],
    ['renglón nulo', [null], /ingredientId/],
    ['ingredientId inválido', [{ ingredientId: 'x', quantity: 1 }], /ingredientId/],
    ['ingredientId cero', [{ ingredientId: 0, quantity: 1 }], /ingredientId/],
    ['cantidad cero', [{ ingredientId: 1, quantity: 0 }], /cantidad/],
    ['cantidad negativa', [{ ingredientId: 1, quantity: -2 }], /cantidad/],
    ['cantidad no numérica', [{ ingredientId: 1, quantity: 'mucho' }], /cantidad/],
    ['unidad vacía', [{ ingredientId: 1, quantity: 1, measurementUnit: '  ' }], /unidad/],
    ['unidad que no es texto', [{ ingredientId: 1, quantity: 1, measurementUnit: 5 }], /unidad/],
    [
      'insumo repetido',
      [
        { ingredientId: 1, quantity: 1 },
        { ingredientId: 1, quantity: 2 },
      ],
      /repetirse/,
    ],
  ])('rechaza: %s', (_label, input, message) => {
    const result = parseRecipeIngredients(input);
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toMatch(message);
  });
});
