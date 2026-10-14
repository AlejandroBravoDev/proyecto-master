import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductModal from '../../src/app/products/components/ProductModal';
import { jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';

const NAME = /Hamburguesa con Queso/; // las etiquetas de este formulario no están asociadas a los campos: se usan los placeholders
const PRICE = /Ej: 7\.50/;
const DESCRIPTION = /Detalles sobre ingredientes/;

// Referencia estable: un arreglo nuevo en cada render reiniciaría el formulario (efecto con [categories]).
const CATEGORIES = [
  { id: 1, name: 'Hamburguesas' },
  { id: 2, name: 'Bebidas' },
];

const PRODUCT = {
  id: 7,
  name: 'Hamburguesa',
  categoryId: 1,
  salePrice: 8.5,
  description: 'Con queso',
  productType: 'PREPARED',
  available: true,
  recipe: {
    id: 3,
    recipeDetails: [
      { ingredientId: 2, quantity: 0.2, measurementUnit: 'kg', ingredient: { id: 2, name: 'Carne', measurementUnit: 'kg' } },
      { ingredientId: 5, quantity: 1, measurementUnit: 'unidad', ingredient: { id: 5, name: 'Pan', measurementUnit: 'unidad' } },
    ],
  },
};

function setup(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  const user = userEvent.setup({ delay: null });
  const utils = render(<ProductModal isOpen onClose={onClose} onSubmit={onSubmit} categories={CATEGORIES} {...props} />);
  return { onSubmit, onClose, user, ...utils };
}

const submitEdit = (user) => user.click(screen.getByRole('button', { name: /Actualizar Producto/ }));
const payloadOf = (onSubmit) => onSubmit.mock.calls[0][0];

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
});

describe('<ProductModal /> crear', () => {
  it('no renderiza nada si está cerrado', () => {
    const { container } = render(<ProductModal isOpen={false} onClose={() => {}} onSubmit={() => {}} categories={CATEGORIES} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('rechaza un nombre de solo espacios y no llama a onSubmit', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByPlaceholderText(NAME), '   '); // pasa el `required` del navegador pero no el trim()
    await user.type(screen.getByPlaceholderText(PRICE), '5');
    await user.click(screen.getByRole('button', { name: /Crear Producto/ }));

    expect(await screen.findByText('El nombre del producto es obligatorio.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('crea con la primera categoría, sin descripción (undefined) y sin receta', async () => {
    const { onSubmit, onClose, user } = setup();
    await user.type(screen.getByPlaceholderText(NAME), '  Flan  ');
    await user.type(screen.getByPlaceholderText(PRICE), '4.5');
    await user.click(screen.getByRole('button', { name: /Crear Producto/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = payloadOf(onSubmit);
    expect(payload).toMatchObject({ categoryId: 1, name: 'Flan', salePrice: 4.5, productType: 'PREPARED', available: true });
    expect(payload.description).toBeUndefined();
    expect(payload).not.toHaveProperty('recipe');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('crea con una receta armada desde el buscador de insumos', async () => {
    mockFetchRoutes({
      'GET /api/ingredients': jsonResponse([{ id: 9, name: 'Harina', measurementUnit: 'kg' }]),
    });
    const { onSubmit, user } = setup();

    await user.type(screen.getByPlaceholderText(NAME), 'Pan');
    await user.type(screen.getByPlaceholderText(PRICE), '1');
    await user.click(screen.getByRole('button', { name: /Añadir Insumo/ }));
    await user.click(screen.getByRole('button', { name: /Buscar o seleccionar insumo/ }));
    await user.click(await screen.findByText('Harina'));
    await user.click(screen.getByRole('button', { name: /Crear Producto/ }));

    expect(payloadOf(onSubmit).recipe).toEqual({
      name: 'Receta de Pan',
      ingredients: [{ ingredientId: 9, quantity: 1, measurementUnit: 'kg' }],
    });
  });

  it('una fila de receta sin insumo se rechaza con un mensaje', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByPlaceholderText(NAME), 'Pan');
    await user.type(screen.getByPlaceholderText(PRICE), '1');
    await user.click(screen.getByRole('button', { name: /Añadir Insumo/ }));
    await user.click(screen.getByRole('button', { name: /Crear Producto/ }));

    expect(await screen.findByText(/selecciona un insumo válido y una cantidad mayor a 0/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Crear Producto/ })).toBeEnabled();
  });
});

describe('<ProductModal /> editar (B10)', () => {
  it('precarga los datos y la receta guardada', () => {
    setup({ initialData: PRODUCT });
    expect(screen.getByRole('heading', { name: 'Editar Producto: Hamburguesa' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(NAME)).toHaveValue('Hamburguesa');
    expect(screen.getByPlaceholderText(DESCRIPTION)).toHaveValue('Con queso');
    expect(screen.getByText('Carne')).toBeInTheDocument();
    expect(screen.getByText('Pan')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Cantidad')).toHaveLength(2);
  });

  it('sin tocar la receta NO envía recipe (no se reemplaza innecesariamente)', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await submitEdit(user);

    const payload = payloadOf(onSubmit);
    expect(payload).not.toHaveProperty('recipe');
    expect(payload).toMatchObject({ categoryId: 1, name: 'Hamburguesa', salePrice: 8.5, description: 'Con queso' });
  });

  it('al vaciar la descripción envía null (limpia el campo), no undefined', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.clear(screen.getByPlaceholderText(DESCRIPTION));
    await submitEdit(user);

    const payload = payloadOf(onSubmit);
    expect(payload).toHaveProperty('description', null);
    expect(JSON.stringify(payload)).toContain('"description":null'); // viaja en el JSON
  });

  it('una descripción de solo espacios también la limpia', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.clear(screen.getByPlaceholderText(DESCRIPTION));
    await user.type(screen.getByPlaceholderText(DESCRIPTION), '   ');
    await submitEdit(user);
    expect(payloadOf(onSubmit).description).toBeNull();
  });

  it('al editar el texto de la descripción envía el texto recortado', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.clear(screen.getByPlaceholderText(DESCRIPTION));
    await user.type(screen.getByPlaceholderText(DESCRIPTION), '  Doble carne  ');
    await submitEdit(user);
    expect(payloadOf(onSubmit).description).toBe('Doble carne');
  });

  it('si se quita un insumo, envía la receta completa con los que quedan', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.click(screen.getAllByTitle('Quitar insumo')[1]); // quita "Pan"
    await submitEdit(user);

    expect(payloadOf(onSubmit).recipe).toEqual({
      name: 'Receta de Hamburguesa',
      ingredients: [{ ingredientId: 2, quantity: 0.2, measurementUnit: 'kg' }],
    });
  });

  it('si cambia una cantidad, envía la receta con la cantidad nueva', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    const quantity = screen.getAllByPlaceholderText('Cantidad')[0];
    await user.clear(quantity);
    await user.type(quantity, '0.35');
    await submitEdit(user);

    expect(payloadOf(onSubmit).recipe.ingredients).toEqual([
      { ingredientId: 2, quantity: 0.35, measurementUnit: 'kg' },
      { ingredientId: 5, quantity: 1, measurementUnit: 'unidad' },
    ]);
  });

  it('si se quitan todos los insumos, envía una receta vacía (reemplaza la anterior)', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.click(screen.getAllByTitle('Quitar insumo')[0]);
    await user.click(screen.getAllByTitle('Quitar insumo')[0]);
    await submitEdit(user);

    expect(payloadOf(onSubmit).recipe).toEqual({ name: 'Receta de Hamburguesa', ingredients: [] });
  });

  it('añadir una fila vacía en edición se rechaza con un mensaje y no envía nada', async () => {
    const { onSubmit, user } = setup({ initialData: PRODUCT });
    await user.click(screen.getByRole('button', { name: /Añadir Insumo/ }));
    await submitEdit(user);

    expect(await screen.findByText(/selecciona un insumo válido y una cantidad mayor a 0/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('un producto sin receta guardada y sin filas no envía recipe', async () => {
    const { onSubmit, user } = setup({ initialData: { ...PRODUCT, recipe: null } });
    await submitEdit(user);
    expect(payloadOf(onSubmit)).not.toHaveProperty('recipe');
  });

  it('un producto de venta directa no envía receta', async () => {
    const { onSubmit, user } = setup({ initialData: { ...PRODUCT, productType: 'DIRECT_INVENTORY', recipe: null } });
    expect(screen.queryByText(/Receta e Insumos a Descontar/)).not.toBeInTheDocument();
    await submitEdit(user);
    expect(payloadOf(onSubmit)).not.toHaveProperty('recipe');
    expect(payloadOf(onSubmit).productType).toBe('DIRECT_INVENTORY');
  });

  it('al reabrir con otro producto se reinicia la receta y su referencia de comparación', async () => {
    const { onSubmit, user, rerender } = setup({ initialData: PRODUCT });
    await user.click(screen.getAllByTitle('Quitar insumo')[1]);

    const other = { ...PRODUCT, id: 8, name: 'Otro', recipe: { recipeDetails: [PRODUCT.recipe.recipeDetails[0]] } };
    rerender(<ProductModal isOpen onClose={() => {}} onSubmit={onSubmit} categories={CATEGORIES} initialData={other} />);

    expect(screen.getAllByPlaceholderText('Cantidad')).toHaveLength(1);
    await submitEdit(user);
    expect(payloadOf(onSubmit)).not.toHaveProperty('recipe'); // sin cambios respecto a la receta del producto nuevo
  });

  it('anti doble envío: dos clics seguidos = una sola llamada', async () => {
    let release;
    const onSubmit = vi.fn(() => new Promise((resolve) => (release = resolve)));
    const { user } = setup({ initialData: PRODUCT, onSubmit });

    await submitEdit(user);
    await user.click(screen.getByRole('button', { name: /Guardando/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  it('si onSubmit falla muestra el error del servidor y no cierra', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Ya existe un producto con ese nombre.'));
    const { onClose, user } = setup({ initialData: PRODUCT, onSubmit });
    await submitEdit(user);

    expect(await screen.findByText('Ya existe un producto con ese nombre.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Actualizar Producto/ })).toBeEnabled();
  });
});
