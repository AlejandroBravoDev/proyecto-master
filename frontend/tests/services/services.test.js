import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobResponse, brokenJsonResponse, callOf, jsonResponse, mockFetch } from '../helpers/fetchMock';
import { NETWORK_ERROR_MESSAGE } from '../../src/config/apiFetch';
import { fetchCurrentUser, loginUser } from '../../src/app/auth/services/authService';
import { setStoredToken } from '../../src/app/auth/authStorage';
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  fetchCategories,
  fetchIngredientsForRecipe,
  fetchProductDetail,
  fetchProducts,
  saveProductRecipe,
  updateProduct,
} from '../../src/app/products/services/productService';
import { fetchDashboardKPIs } from '../../src/app/dashboard/services/dashboardService';
import {
  createUser,
  fetchUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus,
} from '../../src/app/users/services/userService';
import {
  closeCajaSession,
  fetchCajaHistory,
  fetchCajaSessionDetail,
  fetchCajaStatus,
  fetchUsersForCaja,
  openCajaSession,
  updateCajaSession,
} from '../../src/app/caja/services/cajaService';
import {
  createOrder,
  deleteOrder,
  fetchCajaStatusForOrders,
  fetchCategoriesForOrders,
  fetchOrderById,
  fetchOrders,
  fetchProductsForOrders,
} from '../../src/app/orders/services/orderService';
import {
  createIngredient,
  deleteIngredient,
  downloadIngredientsTemplate,
  exportIngredientsReport,
  fetchIngredientDetail,
  fetchIngredients,
  fetchInventoryAlerts,
  fetchInventoryMovements,
  importIngredientsExcel,
  updateIngredient,
} from '../../src/app/inventory/services/inventoryService';

const BASE = 'http://localhost:3055';

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE);
});

describe('authService.loginUser', () => {
  it('envía POST JSON a /api/auth/login y devuelve el usuario y el token', async () => {
    const user = { id: 1, username: 'Admin', role: 'ADMIN', active: true };
    const fetchMock = mockFetch(jsonResponse({ user, token: 'jwt-123' }));

    await expect(loginUser({ username: 'Admin', password: '123456' })).resolves.toEqual({ user, token: 'jwt-123' });

    const { url, options, body } = callOf(fetchMock);
    expect(url).toBe(`${BASE}/api/auth/login`);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(body).toEqual({ username: 'Admin', password: '123456' });
  });

  it('es una petición pública: no manda el token de una sesión anterior', async () => {
    setStoredToken('token-anterior');
    const fetchMock = mockFetch(jsonResponse({ user: { id: 1 }, token: 'jwt-123' }));

    await loginUser({ username: 'Admin', password: '123456' });

    expect(callOf(fetchMock).options.headers).not.toHaveProperty('Authorization');
  });

  it.each([
    ['sin token', { user: { id: 1 } }],
    ['con un token vacío', { user: { id: 1 }, token: '' }],
    ['con un token que no es texto', { user: { id: 1 }, token: 123 }],
    ['sin usuario', { token: 'jwt-123' }],
    ['con el cuerpo vacío', {}],
  ])('una respuesta correcta %s es un error (no se puede iniciar sesión)', async (_name, body) => {
    mockFetch(jsonResponse(body));
    await expect(loginUser({ username: 'Admin', password: '123456' })).rejects.toThrow(/no devolvió una sesión válida/);
  });

  it('propaga el mensaje en español del backend', async () => {
    mockFetch(jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401));
    await expect(loginUser({ username: 'x', password: 'y' })).rejects.toThrow('Usuario o contraseña incorrectos.');
  });

  it('añade los details del backend al mensaje cuando son texto', async () => {
    mockFetch(jsonResponse({ error: 'Error interno', details: 'boom' }, 500));
    await expect(loginUser({ username: 'x', password: 'y' })).rejects.toThrow('Error interno: boom');
  });

  it('ignora details cuando no es texto (un objeto de error de Prisma no se muestra)', async () => {
    mockFetch(jsonResponse({ error: 'Error interno', details: { code: 'P2003' } }, 500));
    await expect(loginUser({ username: 'x', password: 'y' })).rejects.toThrow(/^Error interno$/);
  });

  it('si el cuerpo no es JSON usa un mensaje genérico con el código HTTP', async () => {
    mockFetch(brokenJsonResponse(502));
    await expect(loginUser({ username: 'x', password: 'y' })).rejects.toThrow(/502/);
  });
});

describe('authService.fetchCurrentUser', () => {
  it('pide GET /api/auth/me con el token y devuelve el usuario fresco', async () => {
    setStoredToken('jwt-123');
    const user = { id: 2, username: 'maria', role: 'WORKER', active: true };
    const fetchMock = mockFetch(jsonResponse({ user }));

    await expect(fetchCurrentUser()).resolves.toEqual(user);

    const { url, options } = callOf(fetchMock);
    expect(url).toBe(`${BASE}/api/auth/me`);
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer jwt-123');
  });

  it('una respuesta sin usuario es un error', async () => {
    setStoredToken('jwt-123');
    mockFetch(jsonResponse({}));
    await expect(fetchCurrentUser()).rejects.toThrow('El servidor no devolvió los datos del usuario.');
  });

  it('propaga el texto del servidor y, sin texto, un mensaje genérico con el código', async () => {
    setStoredToken('jwt-123');
    mockFetch(jsonResponse({ error: 'Texto del backend' }, 500));
    await expect(fetchCurrentUser()).rejects.toThrow('Texto del backend');

    mockFetch(brokenJsonResponse(502));
    await expect(fetchCurrentUser()).rejects.toThrow('Error (502): No se pudo verificar la sesión.');
  });
});

describe('productService', () => {
  it('fetchProducts arma la query solo con los filtros presentes', async () => {
    const fetchMock = mockFetch(jsonResponse([]));
    await fetchProducts({ categoryId: 3, available: false, productType: 'PREPARED' });
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/products?categoryId=3&available=false&productType=PREPARED`);

    await fetchProducts();
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/products`);

    await fetchProducts({ available: '' });
    expect(callOf(fetchMock, 2).url).toBe(`${BASE}/api/products`);
  });

  it('fetchProducts lanza un error en español con el código HTTP', async () => {
    mockFetch(jsonResponse({}, 500));
    await expect(fetchProducts()).rejects.toThrow('Error (500): No se pudieron cargar los productos.');
  });

  it('createProduct hace POST con el cuerpo y devuelve el producto', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 9, name: 'Flan' }, 201));
    await expect(createProduct({ name: 'Flan', salePrice: 4 })).resolves.toMatchObject({ id: 9 });
    const { options, body } = callOf(fetchMock);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ name: 'Flan', salePrice: 4 });
  });

  it('createProduct muestra el error del backend; si no hay, uno genérico', async () => {
    mockFetch(jsonResponse({ error: 'Faltan datos' }, 400));
    await expect(createProduct({})).rejects.toThrow('Faltan datos');

    mockFetch(brokenJsonResponse(500));
    await expect(createProduct({})).rejects.toThrow('Error (500): No se pudo crear el producto.');
  });

  it('updateProduct usa PUT y deleteProduct usa DELETE sobre /:id', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    await updateProduct(7, { available: false });
    await deleteProduct(7);
    expect(callOf(fetchMock, 0)).toMatchObject({ url: `${BASE}/api/products/7`, body: { available: false } });
    expect(callOf(fetchMock, 0).options.method).toBe('PUT');
    expect(callOf(fetchMock, 1).options.method).toBe('DELETE');
  });

  it('createCategory y fetchIngredientsForRecipe apuntan a sus rutas (con búsqueda codificada)', async () => {
    const fetchMock = mockFetch(jsonResponse([]));
    await createCategory({ name: 'Postres' });
    await fetchIngredientsForRecipe('pan & queso');
    expect(callOf(fetchMock, 0).url).toBe(`${BASE}/api/categories`);
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/ingredients?search=pan%20%26%20queso`);
  });
});

describe('dashboardService.fetchDashboardKPIs', () => {
  it('transforma el KPI del backend en 4 tarjetas con valores numéricos', async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        period: 'month',
        totalRevenue: 20.22,
        totalItemsSold: 3,
        grossProfit: 14.51,
        stockAlertsCount: 2,
        topSellingProducts: [{ id: 1, name: 'Hamburguesa', totalSold: 2 }],
        criticalStockIngredients: [],
      })
    );

    const result = await fetchDashboardKPIs('month');
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/dashboard/kpis?period=month`);
    expect(result.period).toBe('month');
    expect(result.cards.map((c) => c.key)).toEqual(['totalRevenue', 'totalItemsSold', 'grossProfit', 'stockAlertsCount']);
    expect(result.cards[0]).toMatchObject({ rawValue: 20.22, type: 'currency' });
    expect(result.topSellingProducts).toHaveLength(1);
  });

  it('rellena con ceros y arreglos vacíos cuando faltan campos', async () => {
    mockFetch(jsonResponse({}));
    const result = await fetchDashboardKPIs();
    expect(result.period).toBe('day');
    expect(result.cards.every((c) => c.rawValue === 0)).toBe(true);
    expect(result.topSellingProducts).toEqual([]);
    expect(result.criticalStockIngredients).toEqual([]);
  });

  it('lanza error en español si el servidor falla', async () => {
    mockFetch(jsonResponse({}, 500));
    await expect(fetchDashboardKPIs()).rejects.toThrow(/No se pudieron obtener los KPIs/);
  });
});

describe('userService.fetchUsers', () => {
  it('normaliza el arreglo plano del backend a { total, users, ... } (known-issues I1)', async () => {
    const fetchMock = mockFetch(jsonResponse([{ id: 1 }, { id: 2 }]));
    const result = await fetchUsers(2, 10);
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/users?page=2&limit=10`);
    expect(result).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    expect(result.users).toHaveLength(2);
  });

  it('deja pasar la respuesta paginada si el backend ya la devuelve así', async () => {
    const paged = { total: 40, page: 2, limit: 15, totalPages: 3, users: [{ id: 16 }] };
    mockFetch(jsonResponse(paged));
    await expect(fetchUsers(2)).resolves.toEqual(paged);
  });
});

describe('cajaService', () => {
  it('fetchCajaStatus consulta /api/caja/status', async () => {
    const fetchMock = mockFetch(jsonResponse({ isOpen: false, activeSession: null }));
    await expect(fetchCajaStatus()).resolves.toMatchObject({ isOpen: false });
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/caja/status`);
  });

  it('openCajaSession envía las denominaciones y traduce errores del backend', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 1, status: 'OPEN' }, 201));
    await openCajaSession({ denominations: { '1': 5 }, userId: 1 });
    expect(callOf(fetchMock)).toMatchObject({ url: `${BASE}/api/caja/open`, body: { denominations: { '1': 5 }, userId: 1 } });

    mockFetch(jsonResponse({ error: 'Ya existe una caja abierta' }, 400));
    await expect(openCajaSession({ denominations: { '1': 5 } })).rejects.toThrow('Ya existe una caja abierta');
  });

  it('closeCajaSession usa POST /api/caja/close', async () => {
    const fetchMock = mockFetch(jsonResponse({ status: 'CLOSED' }));
    await closeCajaSession({ denominations: { '1': 5 } });
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/caja/close`);
    expect(callOf(fetchMock).options.method).toBe('POST');
  });

  it('las consultas ahora también muestran el error en español del backend', async () => {
    mockFetch(jsonResponse({ error: 'No hay sesión de caja con ese id.' }, 404));
    await expect(fetchCajaSessionDetail(99)).rejects.toThrow('No hay sesión de caja con ese id.');
  });
});

// ---------------------------------------------------------------------------------------------
// Capa HTTP compartida (config/apiFetch.js): TODOS los services comparten el mismo manejo de errores
// ---------------------------------------------------------------------------------------------
const SERVICE_CALLS = [
  ['loginUser', () => loginUser({ username: 'a', password: 'b' })],
  ['fetchCurrentUser', () => fetchCurrentUser()],
  ['fetchUsers', () => fetchUsers()],
  ['createUser', () => createUser({ fullName: 'A', username: 'a', password: '123456' })],
  ['updateUser', () => updateUser(1, { fullName: 'A' })],
  ['updateUserPassword', () => updateUserPassword(1, '123456')],
  ['updateUserStatus', () => updateUserStatus(1, false)],
  ['fetchProducts', () => fetchProducts()],
  ['fetchProductDetail', () => fetchProductDetail(1)],
  ['createProduct', () => createProduct({ name: 'A' })],
  ['updateProduct', () => updateProduct(1, { name: 'A' })],
  ['deleteProduct', () => deleteProduct(1)],
  ['saveProductRecipe', () => saveProductRecipe(1, { ingredients: [] })],
  ['fetchCategories', () => fetchCategories()],
  ['createCategory', () => createCategory({ name: 'A' })],
  ['deleteCategory', () => deleteCategory(1)],
  ['fetchIngredientsForRecipe', () => fetchIngredientsForRecipe('a')],
  ['fetchOrders', () => fetchOrders()],
  ['fetchCajaStatusForOrders', () => fetchCajaStatusForOrders()],
  ['fetchOrderById', () => fetchOrderById(1)],
  ['createOrder', () => createOrder({ items: [] })],
  ['deleteOrder', () => deleteOrder(1)],
  ['fetchProductsForOrders', () => fetchProductsForOrders()],
  ['fetchCategoriesForOrders', () => fetchCategoriesForOrders()],
  ['fetchCajaStatus', () => fetchCajaStatus()],
  ['openCajaSession', () => openCajaSession({ denominations: {} })],
  ['closeCajaSession', () => closeCajaSession({ denominations: {} })],
  ['updateCajaSession', () => updateCajaSession(1, {})],
  ['fetchCajaHistory', () => fetchCajaHistory()],
  ['fetchCajaSessionDetail', () => fetchCajaSessionDetail(1)],
  ['fetchUsersForCaja', () => fetchUsersForCaja()],
  ['fetchIngredients', () => fetchIngredients()],
  ['fetchIngredientDetail', () => fetchIngredientDetail(1)],
  ['createIngredient', () => createIngredient({ name: 'A' })],
  ['updateIngredient', () => updateIngredient(1, { name: 'A' })],
  ['deleteIngredient', () => deleteIngredient(1)],
  ['fetchInventoryAlerts', () => fetchInventoryAlerts()],
  ['fetchInventoryMovements', () => fetchInventoryMovements()],
  ['downloadIngredientsTemplate', () => downloadIngredientsTemplate()],
  ['exportIngredientsReport', () => exportIngredientsReport()],
  ['importIngredientsExcel', () => importIngredientsExcel(new File(['x'], 'insumos.xlsx'))],
  ['fetchDashboardKPIs', () => fetchDashboardKPIs()],
];

describe('capa HTTP compartida: comportamiento común de todos los services (I9 + I5)', () => {
  it.each(SERVICE_CALLS)('%s: con el backend caído muestra un mensaje en español, no "Failed to fetch"', async (_name, call) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(call()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });

  it.each(SERVICE_CALLS)('%s: propaga el texto "error" del backend', async (_name, call) => {
    mockFetch(jsonResponse({ error: 'Texto del backend' }, 400));
    await expect(call()).rejects.toThrow('Texto del backend');
  });

  it.each(SERVICE_CALLS)('%s: sin texto del backend usa un mensaje genérico con el código HTTP', async (_name, call) => {
    mockFetch(brokenJsonResponse(500));
    await expect(call()).rejects.toThrow(/^Error \(500\): /);
  });

  // Con la sesión iniciada TODA función de service manda `Authorization: Bearer <token>`, salvo el login
  // (público). Si un service volviera a llamar a `fetch` directo, esta prueba lo delataría.
  it.each(SERVICE_CALLS.filter(([name]) => name !== 'loginUser'))(
    '%s: manda el token de la sesión en la cabecera Authorization',
    async (_name, call) => {
      setStoredToken('jwt-de-sesion');
      const fetchMock = mockFetch(blobResponse('contenido'));
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); // las descargas no navegan en jsdom

      await call().catch(() => {}); // aquí solo importa la petición que salió (las descargas fallan al crear el archivo)

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const options = fetchMock.mock.calls[0][1]; // callOf intentaría parsear como JSON el FormData de la importación
      expect(options.headers.Authorization).toBe('Bearer jwt-de-sesion');
    }
  );

  it.each(SERVICE_CALLS.filter(([name]) => name !== 'loginUser'))(
    '%s: un 401 cierra la sesión guardada y el error sigue mostrando el texto del servidor',
    async (_name, call) => {
      setStoredToken('jwt-de-sesion');
      mockFetch(jsonResponse({ error: 'Sesión vencida', code: 'TOKEN_EXPIRED' }, 401));

      await expect(call()).rejects.toThrow('Sesión vencida');

      expect(sessionStorage.getItem('masterfood_auth_token')).toBeNull();
    }
  );

  it('el mismo error del backend se muestra igual en products (antes solo "error") y en users (antes con details)', async () => {
    const body = { error: 'Error al guardar', details: 'columna duplicada' };

    mockFetch(jsonResponse(body, 500));
    await expect(createProduct({})).rejects.toThrow('Error al guardar: columna duplicada');

    mockFetch(jsonResponse(body, 500));
    await expect(createUser({})).rejects.toThrow('Error al guardar: columna duplicada');
  });

  it('un details que es un objeto (p. ej. un error de Prisma) no llega a la pantalla', async () => {
    mockFetch(jsonResponse({ error: 'Error al crear la comanda', details: { code: 'P2003', meta: { field: 'x' } } }, 500));
    await expect(createOrder({ items: [] })).rejects.toThrow(/^Error al crear la comanda$/);
  });

  it('el texto genérico de cada función sigue en español', async () => {
    mockFetch(jsonResponse({}, 503));
    await expect(fetchOrders()).rejects.toThrow('Error (503): No se pudieron cargar las comandas.');
    await expect(fetchDashboardKPIs()).rejects.toThrow('Error (503): No se pudieron obtener los KPIs.');
    await expect(importIngredientsExcel(new File(['x'], 'a.xlsx'))).rejects.toThrow(
      'Error (503): Falló la importación masiva de insumos.'
    );
  });
});

describe('productService: borrados con reglas del backend (B5, B6)', () => {
  it('deleteProduct muestra el motivo real cuando el producto tiene historial (400)', async () => {
    mockFetch(jsonResponse({ error: 'El producto tiene historial de comandas o ventas; desactívalo en lugar de eliminarlo.' }, 400));
    await expect(deleteProduct(7)).rejects.toThrow('desactívalo en lugar de eliminarlo');
  });

  it('deleteCategory muestra el mensaje del backend cuando la categoría tiene productos (400)', async () => {
    const fetchMock = mockFetch(jsonResponse({ error: 'No se puede eliminar una categoría que tiene productos.' }, 400));
    await expect(deleteCategory(4)).rejects.toThrow('No se puede eliminar una categoría que tiene productos.');
    expect(callOf(fetchMock)).toMatchObject({ url: `${BASE}/api/categories/4` });
    expect(callOf(fetchMock).options.method).toBe('DELETE');
  });
});

describe('productService: editar descripción y receta (B10)', () => {
  it('updateProduct envía description: null (limpia el campo) y omite lo que es undefined', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 7 }));
    await updateProduct(7, { name: 'Flan', description: null, image: undefined });
    expect(fetchMock.mock.calls[0][1].body).toBe('{"name":"Flan","description":null}');
  });

  it('saveProductRecipe hace POST /api/recipes con productId numérico, nombre e insumos', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 3 }, 201));
    const ingredients = [{ ingredientId: 2, quantity: 0.5, measurementUnit: 'kg' }];

    await expect(saveProductRecipe('7', { name: 'Receta de Flan', ingredients })).resolves.toMatchObject({ id: 3 });

    const { url, options, body } = callOf(fetchMock);
    expect(url).toBe(`${BASE}/api/recipes`);
    expect(options.method).toBe('POST');
    expect(body).toEqual({ productId: 7, name: 'Receta de Flan', ingredients });
  });

  it('saveProductRecipe sin nombre no lo envía y permite vaciar la receta (insumos = [])', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 3 }, 201));
    await saveProductRecipe(7, { ingredients: [] });
    expect(callOf(fetchMock).body).toEqual({ productId: 7, ingredients: [] });
  });
});

describe('orderService: errores de la comanda (B7)', () => {
  it('createOrder muestra el detalle de stock insuficiente que viene en "error" (400)', async () => {
    const fetchMock = mockFetch(
      jsonResponse({ error: 'Stock insuficiente de "Pan" (necesitas 4 und, hay 2 und).' }, 400)
    );
    await expect(createOrder({ items: [{ productId: 1, quantity: 2 }] })).rejects.toThrow(
      'Stock insuficiente de "Pan" (necesitas 4 und, hay 2 und).'
    );
    expect(callOf(fetchMock)).toMatchObject({ url: `${BASE}/api/orders`, body: { items: [{ productId: 1, quantity: 2 }] } });
  });

  it('createOrder conserva el texto de caja cerrada que la UI reconoce por contenido (I7)', async () => {
    mockFetch(jsonResponse({ error: 'No se puede crear la comanda porque la caja está cerrada. Abra un turno de caja primero.' }, 400));
    await expect(createOrder({ items: [] })).rejects.toThrow(/caja está cerrada/);
  });

  it('fetchOrders arma la query con date o con scope', async () => {
    const fetchMock = mockFetch(jsonResponse([]));
    await fetchOrders();
    await fetchOrders({ scope: 'all' });
    await fetchOrders({ date: '2026-10-13', scope: 'all' });
    expect(callOf(fetchMock, 0).url).toBe(`${BASE}/api/orders?scope=active`);
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/orders?scope=all`);
    expect(callOf(fetchMock, 2).url).toBe(`${BASE}/api/orders?date=2026-10-13`);
  });

  it('fetchProductsForOrders pide solo los disponibles', async () => {
    const fetchMock = mockFetch(jsonResponse([]));
    await fetchProductsForOrders();
    expect(callOf(fetchMock).url).toBe(`${BASE}/api/products?available=true`);
  });
});

describe('userService: PATCH y PUT', () => {
  it('updateUserPassword y updateUserStatus usan PATCH con su cuerpo JSON', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    await updateUserPassword(3, 'abc123');
    await updateUserStatus(3, false);

    expect(callOf(fetchMock, 0)).toMatchObject({ url: `${BASE}/api/users/3/password`, body: { password: 'abc123' } });
    expect(callOf(fetchMock, 0).options.method).toBe('PATCH');
    expect(callOf(fetchMock, 1)).toMatchObject({ url: `${BASE}/api/users/3/status`, body: { active: false } });
    expect(callOf(fetchMock, 1).options.method).toBe('PATCH');
  });

  it('updateUser usa PUT sobre /api/users/:id', async () => {
    const fetchMock = mockFetch(jsonResponse({ id: 3 }));
    await updateUser(3, { fullName: 'Ana' });
    expect(callOf(fetchMock)).toMatchObject({ url: `${BASE}/api/users/3`, body: { fullName: 'Ana' } });
    expect(callOf(fetchMock).options.method).toBe('PUT');
  });
});

describe('cajaService: historial y empleados', () => {
  it('fetchCajaHistory manda limit, page y, si hay, el usuario', async () => {
    const fetchMock = mockFetch(jsonResponse({ sessions: [] }));
    await fetchCajaHistory(10, 2, 5);
    await fetchCajaHistory();
    expect(callOf(fetchMock, 0).url).toBe(`${BASE}/api/caja/history?limit=10&page=2&openedByUserId=5`);
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/caja/history?limit=50&page=1`);
  });

  it('fetchUsersForCaja acepta un arreglo o { users }', async () => {
    mockFetch(jsonResponse([{ id: 1 }]));
    await expect(fetchUsersForCaja()).resolves.toEqual([{ id: 1 }]);
    mockFetch(jsonResponse({ users: [{ id: 2 }] }));
    await expect(fetchUsersForCaja()).resolves.toEqual([{ id: 2 }]);
    mockFetch(jsonResponse({}));
    await expect(fetchUsersForCaja()).resolves.toEqual([]);
  });
});

describe('inventoryService', () => {
  const stubDownloadApis = () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
    const downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      downloads.push({ href: this.href, download: this.download });
    });
    return { createObjectURL, revokeObjectURL, downloads };
  };

  it('plantilla y reporte comparten el mismo flujo de descarga con su nombre de archivo', async () => {
    const { createObjectURL, revokeObjectURL, downloads } = stubDownloadApis();
    const fetchMock = mockFetch(blobResponse('xlsx'));

    await downloadIngredientsTemplate();
    await exportIngredientsReport();

    expect(callOf(fetchMock, 0).url).toBe(`${BASE}/api/ingredients/template/ingredients`);
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/ingredients/export/ingredients`);
    expect(downloads.map((d) => d.download)).toEqual([
      'plantilla_carga_ingredientes.xlsx',
      'reporte_inventario_ingredientes.xlsx',
    ]);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(document.querySelector('a[download]')).toBeNull(); // el enlace temporal se quita del DOM
  });

  it('si la descarga falla muestra el mensaje y no crea ningún archivo', async () => {
    const { createObjectURL, downloads } = stubDownloadApis();

    mockFetch(brokenJsonResponse(500));
    await expect(downloadIngredientsTemplate()).rejects.toThrow('Error (500): No se pudo descargar la plantilla de insumos.');
    await expect(exportIngredientsReport()).rejects.toThrow('Error (500): No se pudo exportar el reporte de inventario.');

    mockFetch(jsonResponse({ error: 'No hay insumos para exportar.' }, 400));
    await expect(exportIngredientsReport()).rejects.toThrow('No hay insumos para exportar.');

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
  });

  it('importIngredientsExcel sube el archivo como multipart sin Content-Type y devuelve el resumen', async () => {
    const summary = { message: 'ok', summary: { created: 1, updated: 0, skipped: 0, errors: [] } };
    const fetchMock = mockFetch(jsonResponse(summary));
    const file = new File(['x'], 'insumos.xlsx');

    await expect(importIngredientsExcel(file)).resolves.toEqual(summary);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/ingredients/import/ingredients`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file').name).toBe('insumos.xlsx');
    expect(options.headers).not.toHaveProperty('Content-Type');
  });

  it('importIngredientsExcel muestra el error del backend', async () => {
    mockFetch(jsonResponse({ error: 'Solo se admiten archivos .xlsx' }, 400));
    await expect(importIngredientsExcel(new File(['x'], 'a.csv'))).rejects.toThrow('Solo se admiten archivos .xlsx');
  });

  it('fetchInventoryMovements solo envía los filtros presentes', async () => {
    const fetchMock = mockFetch(jsonResponse([]));
    await fetchInventoryMovements({ ingredientId: 4, type: 'IN' });
    await fetchInventoryMovements();
    expect(callOf(fetchMock, 0).url).toBe(`${BASE}/api/inventory/movements?ingredientId=4&type=IN`);
    expect(callOf(fetchMock, 1).url).toBe(`${BASE}/api/inventory/movements`);
  });
});

describe('dashboardService: sin datos inventados', () => {
  it('las tarjetas solo llevan lo que viene del backend (sin tendencia)', async () => {
    mockFetch(jsonResponse({ totalRevenue: 10, totalItemsSold: 2, grossProfit: 4, stockAlertsCount: 1 }));
    const { cards } = await fetchDashboardKPIs('day');
    cards.forEach((card) => {
      expect(card).not.toHaveProperty('trend');
      expect(card).not.toHaveProperty('change');
    });
  });
});
