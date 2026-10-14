import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductsPage from '../../src/app/products/ProductsPage';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../../src/app/common/alertUtils';
import { callOf, jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';
import { renderAsAdmin, renderAsWorker } from '../helpers/renderWithApp';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const CATEGORY = { id: 1, name: 'Hamburguesas' };

const BURGER = {
  id: 7,
  name: 'Hamburguesa',
  categoryId: 1,
  category: CATEGORY,
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

const SODA = {
  id: 8,
  name: 'Gaseosa',
  categoryId: 1,
  category: CATEGORY,
  salePrice: 2,
  description: null,
  productType: 'DIRECT_INVENTORY',
  available: true,
  recipe: null,
};

const productCalls = (fetchMock) => fetchMock.mock.calls.filter(([url, o]) => /\/api\/products$/.test(url) && (o?.method ?? 'GET') === 'GET');

function mockApi(extra = {}) {
  return mockFetchRoutes({
    'GET /api/products': jsonResponse([BURGER, SODA]),
    'GET /api/categories': jsonResponse([CATEGORY]),
    ...extra,
  });
}

async function renderPage({ worker = false } = {}) {
  const user = userEvent.setup({ delay: null });
  const utils = worker ? renderAsWorker(<ProductsPage />) : renderAsAdmin(<ProductsPage />);
  await screen.findByText('Hamburguesa');
  return { user, ...utils };
}

const clickOnCard = (user, name, title) => user.click(within(screen.getByRole('heading', { name }).closest('div.bg-white')).getByTitle(title));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
  confirmDialog.mockResolvedValue({ isConfirmed: true });
});

describe('<ProductsPage /> listado', () => {
  it('muestra los productos, sin toast propio ni errores', async () => {
    mockApi();
    await renderPage();
    expect(screen.getByText('Gaseosa')).toBeInTheDocument();
    expect(screen.queryByText(/Error al conectar/)).not.toBeInTheDocument();
  });

  it('con el backend caído muestra el error en español con "Reintentar"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderAsAdmin(<ProductsPage />);

    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('un trabajador (no admin) no ve las acciones de editar ni eliminar', async () => {
    mockApi();
    await renderPage({ worker: true });
    expect(screen.queryByTitle('Editar producto')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Eliminar producto')).not.toBeInTheDocument();
  });
});

describe('<ProductsPage /> eliminar producto (B6, I6)', () => {
  it('el diálogo avisa del historial y sugiere dejarlo como "No Disponible"', async () => {
    mockApi({ 'DELETE /api/products/7': jsonResponse({ message: 'ok' }) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Hamburguesa', 'Eliminar producto');

    expect(confirmDialog).toHaveBeenCalledTimes(1);
    const { title, text } = confirmDialog.mock.calls[0][0];
    expect(title).toBe('¿Eliminar "Hamburguesa"?');
    expect(text).toMatch(/historial de comandas o ventas/);
    expect(text).toMatch(/No Disponible/);
  });

  it('si el producto tiene historial (400) muestra el mensaje del servidor, no uno genérico', async () => {
    const message = 'El producto tiene historial de comandas o ventas; desactívalo en lugar de eliminarlo.';
    mockApi({ 'DELETE /api/products/7': jsonResponse({ error: message }, 400) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Hamburguesa', 'Eliminar producto');

    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledTimes(1));
    expect(showErrorAlert).toHaveBeenCalledWith('No se pudo eliminar el producto', message);
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it('si se elimina bien usa showSuccessToast y recarga el listado', async () => {
    const fetchMock = mockApi({ 'DELETE /api/products/8': jsonResponse({ message: 'ok' }) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Gaseosa', 'Eliminar producto');

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Producto eliminado del menú.'));
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(2));
  });

  it('si se cancela el diálogo no se elimina nada', async () => {
    confirmDialog.mockResolvedValue({ isConfirmed: false });
    const fetchMock = mockApi({ 'DELETE /api/products/7': jsonResponse({ message: 'ok' }) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Hamburguesa', 'Eliminar producto');

    expect(fetchMock.mock.calls.some(([, o]) => o?.method === 'DELETE')).toBe(false);
    expect(showErrorAlert).not.toHaveBeenCalled();
  });
});

describe('<ProductsPage /> disponibilidad (I6)', () => {
  it('marcar como no disponible llama al servidor y avisa con showSuccessToast', async () => {
    const fetchMock = mockApi({ 'PUT /api/products/8': jsonResponse({ id: 8, available: false }) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Gaseosa', 'Marcar como No Disponible');

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Producto marcado como agotado.'));
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(JSON.parse(put[1].body)).toEqual({ available: false });
  });

  it('si el servidor falla muestra el error con showErrorAlert (antes se perdía en silencio)', async () => {
    mockApi({ 'PUT /api/products/8': jsonResponse({ error: 'Producto no encontrado' }, 404) });
    const { user } = await renderPage();
    await clickOnCard(user, 'Gaseosa', 'Marcar como No Disponible');

    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledWith('Error al cambiar disponibilidad', 'Producto no encontrado'));
    expect(showSuccessToast).not.toHaveBeenCalled();
  });
});

describe('<ProductsPage /> editar producto con receta (B10)', () => {
  const openEditor = async (user) => {
    await clickOnCard(user, 'Hamburguesa', 'Editar producto');
    await screen.findByRole('heading', { name: 'Editar Producto: Hamburguesa' });
  };
  const save = (user) => user.click(screen.getByRole('button', { name: /Actualizar Producto/ }));

  it('sin cambiar la receta solo actualiza el producto (PUT) y no llama a /api/recipes', async () => {
    const fetchMock = mockApi({ 'PUT /api/products/7': jsonResponse(BURGER) });
    const { user } = await renderPage();
    await openEditor(user);
    await save(user);

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Producto actualizado correctamente.'));
    expect(fetchMock.mock.calls.some(([url]) => /\/api\/recipes/.test(url))).toBe(false);
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(JSON.parse(put[1].body)).not.toHaveProperty('recipe');
  });

  it('al cambiar la receta actualiza el producto y reemplaza la receta con POST /api/recipes', async () => {
    const fetchMock = mockApi({
      'PUT /api/products/7': jsonResponse(BURGER),
      'POST /api/recipes': jsonResponse({ id: 3 }, 201),
    });
    const { user } = await renderPage();
    await openEditor(user);
    await user.click(screen.getAllByTitle('Quitar insumo')[1]); // quita "Pan"
    await save(user);

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Producto actualizado correctamente.'));

    const calls = fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT' || o?.method === 'POST');
    expect(calls.map(([url, o]) => `${o.method} ${new URL(url).pathname}`)).toEqual(['PUT /api/products/7', 'POST /api/recipes']);
    expect(JSON.parse(calls[0][1].body)).not.toHaveProperty('recipe'); // la receta no viaja en el PUT del producto
    expect(JSON.parse(calls[1][1].body)).toEqual({
      productId: 7,
      name: 'Receta de Hamburguesa',
      ingredients: [{ ingredientId: 2, quantity: 0.2, measurementUnit: 'kg' }],
    });
    // el listado se recarga
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(2));
  });

  it('vaciar la descripción envía description: null en el PUT', async () => {
    const fetchMock = mockApi({ 'PUT /api/products/7': jsonResponse(BURGER) });
    const { user } = await renderPage();
    await openEditor(user);
    await user.clear(screen.getByPlaceholderText(/Detalles sobre ingredientes/));
    await save(user);

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(put[1].body).toContain('"description":null');
  });

  it('si el producto se guardó pero la receta falla, lo dice, deja el modal abierto y recarga', async () => {
    const fetchMock = mockApi({
      'PUT /api/products/7': jsonResponse(BURGER),
      'POST /api/recipes': jsonResponse({ error: 'Alguno de los insumos no existe.' }, 400),
    });
    const { user } = await renderPage();
    await openEditor(user);
    await user.click(screen.getAllByTitle('Quitar insumo')[0]);
    await save(user);

    expect(
      await screen.findByText('Los datos del producto se guardaron, pero la receta no: Alguno de los insumos no existe.')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar Producto: Hamburguesa' })).toBeInTheDocument(); // sigue abierto
    expect(showSuccessToast).not.toHaveBeenCalled();
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(2));
  });

  it('si el PUT del producto falla no se intenta guardar la receta', async () => {
    const fetchMock = mockApi({
      'PUT /api/products/7': jsonResponse({ error: 'Producto no encontrado' }, 404),
      'POST /api/recipes': jsonResponse({ id: 3 }, 201),
    });
    const { user } = await renderPage();
    await openEditor(user);
    await user.click(screen.getAllByTitle('Quitar insumo')[0]);
    await save(user);

    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => /\/api\/recipes/.test(url))).toBe(false);
  });
});

describe('<ProductsPage /> crear producto', () => {
  it('crea con POST /api/products (la receta, si hay, viaja anidada) y avisa con showSuccessToast', async () => {
    const fetchMock = mockApi({ 'POST /api/products': jsonResponse({ id: 9 }, 201) });
    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: /Nuevo Producto/ }));
    await user.type(await screen.findByPlaceholderText(/Hamburguesa con Queso/), 'Flan');
    await user.type(screen.getByPlaceholderText(/Ej: 7\.50/), '3');
    await user.click(screen.getByRole('button', { name: /Crear Producto/ }));

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Producto creado exitosamente.'));
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(callOf({ mock: { calls: [post] } }).body).toMatchObject({ name: 'Flan', salePrice: 3, categoryId: 1 });
  });
});
