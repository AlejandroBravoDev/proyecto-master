/**
 * Hallazgos de la auditoría ya corregidos (ver .claude/skills/fullstack-domain-reference/references/known-issues.md):
 * B8 (ids y cuerpos inválidos), S3 (los 500 no filtran internals) y B9 (login sin distinguir mayúsculas).
 *
 * Antes eran `it.failing`; ahora son pruebas normales que impiden que vuelvan.
 */
import { Prisma } from '@prisma/client';
import { categoryService } from '../../src/services/category.service';
import { orderService } from '../../src/services/order.service';
import * as saleUtils from '../../src/utils/sale.utils';
import { closeCaja, openCaja, useTestApp } from '../helpers/testApp';

// `roundQuantity` envuelto en un jest.fn que por defecto llama a la función real: permite simular
// un fallo a mitad de la transacción de createOrder (ver la última prueba de S3).
jest.mock('../../src/utils/sale.utils', () => {
  const actual = jest.requireActual('../../src/utils/sale.utils');
  return { ...actual, roundQuantity: jest.fn(actual.roundQuantity) };
});

const ctx = useTestApp();

/** Rutas con parámetro de id en la ruta (todas las de /api que lo tienen). */
const ID_ROUTES: Array<[method: 'get' | 'put' | 'patch' | 'delete', path: (id: string) => string]> = [
  ['get', (id) => `/api/categories/${id}`],
  ['put', (id) => `/api/categories/${id}`],
  ['delete', (id) => `/api/categories/${id}`],
  ['get', (id) => `/api/products/${id}`],
  ['put', (id) => `/api/products/${id}`],
  ['delete', (id) => `/api/products/${id}`],
  ['get', (id) => `/api/recipes/product/${id}`],
  ['delete', (id) => `/api/recipes/${id}`],
  ['get', (id) => `/api/orders/${id}`],
  ['delete', (id) => `/api/orders/${id}`],
  ['get', (id) => `/api/sales/${id}`],
  ['get', (id) => `/api/ingredients/${id}`],
  ['put', (id) => `/api/ingredients/${id}`],
  ['delete', (id) => `/api/ingredients/${id}`],
  ['get', (id) => `/api/users/${id}`],
  ['put', (id) => `/api/users/${id}`],
  ['patch', (id) => `/api/users/${id}/password`],
  ['patch', (id) => `/api/users/${id}/status`],
  ['put', (id) => `/api/caja/${id}`],
  ['get', (id) => `/api/caja/session/${id}`],
];

describe('B8: un id de ruta inválido responde 400 (no 500)', () => {
  const cases = ID_ROUTES.flatMap(([method, path]) => ['abc', '0', '-1', '1.5', '1e3', '99999999999999999999'].map((id) => [method, path(id)] as const));

  it.each(cases)('%s %s -> 400 { error: "ID inválido" }', async (method, url) => {
    const request = ctx.api[method](url);
    const res = await (method === 'get' || method === 'delete' ? request : request.send({}));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ID inválido' });
  });

  it('un id numérico inexistente sigue siendo 404 (la validación no lo confunde)', async () => {
    expect((await ctx.api.get('/api/categories/999999')).status).toBe(404);
    expect((await ctx.api.get('/api/orders/999999')).status).toBe(404);
    expect((await ctx.api.get('/api/recipes/product/999999')).status).toBe(404);
    expect((await ctx.api.get('/api/caja/session/999999')).status).toBe(404);
  });

  it('un id fuera del rango de enteros de la BD también es 400', async () => {
    expect((await ctx.api.get('/api/categories/2147483648')).status).toBe(400);
  });

  it('los filtros de query con valores inválidos responden 400', async () => {
    const urls = [
      '/api/products?categoryId=abc',
      '/api/products?productType=NO_EXISTE',
      '/api/inventory/movements?ingredientId=abc',
      '/api/inventory/movements?type=SIDEWAYS',
      '/api/inventory/movements?reason=Otro',
      '/api/orders?cashSessionId=abc',
      '/api/orders?date=hoy',
      '/api/orders?date=2026-13-45',
      '/api/caja/history?limit=abc',
      '/api/caja/history?page=0',
      '/api/caja/history?openedByUserId=abc',
      '/api/users?page=abc',
      '/api/users?limit=-5',
    ];
    for (const url of urls) {
      const res = await ctx.api.get(url);
      expect([url, res.status]).toEqual([url, 400]);
      expect(typeof res.body.error).toBe('string');
    }
  });
});

describe('B8: POST/PUT/PATCH sin cuerpo JSON responden 400 (no 500)', () => {
  it.each([
    ['/api/categories'],
    ['/api/products'],
    ['/api/ingredients'],
    ['/api/recipes'],
    ['/api/orders'],
    ['/api/users'],
    ['/api/auth/login'],
    ['/api/caja/open'],
    ['/api/caja/close'],
  ])('POST %s sin cuerpo -> 400', async (url) => {
    const res = await ctx.api.post(url);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('POST /api/sales sin cuerpo -> 400', async () => {
    expect((await ctx.api.post('/api/sales')).status).toBe(400);
  });

  it('PATCH de contraseña y estado sin cuerpo -> 400', async () => {
    const admin = (await ctx.api.get('/api/users')).body[0].id;
    expect((await ctx.api.patch(`/api/users/${admin}/password`)).status).toBe(400);
    expect((await ctx.api.patch(`/api/users/${admin}/status`)).status).toBe(400);
  });

  it('un cuerpo que no es un objeto JSON (arreglo o campos de otro tipo) también es 400', async () => {
    expect((await ctx.api.post('/api/categories').send([])).status).toBe(400);
    expect((await ctx.api.post('/api/auth/login').send({ username: 123, password: 456 })).status).toBe(400);
    expect((await ctx.api.post('/api/users').send({ fullName: 1, username: 2, password: 3 })).status).toBe(400);
  });
});

describe('S3: los 500 no filtran internals', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('un error interno de Prisma devuelve details como texto genérico, sin consultas ni códigos', async () => {
    jest.spyOn(categoryService, 'getAllCategories').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Invalid `prisma.category.findMany()` invocation: tabla secreta', {
        code: 'P2003',
        clientVersion: 'test',
        meta: { modelName: 'Category', field_name: 'category_id' },
      })
    );

    const res = await ctx.api.get('/api/categories');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Error al obtener categorías');
    expect(typeof res.body.details).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|P2003|invocation|clientVersion|secreta|category_id/i);
  });

  it('un error de validación de Prisma tampoco se filtra', async () => {
    jest.spyOn(categoryService, 'getAllCategories').mockRejectedValueOnce(
      new Prisma.PrismaClientValidationError('Argument `where` is missing. Unknown argument `foo`', { clientVersion: 'test' })
    );

    const res = await ctx.api.get('/api/categories');
    expect(res.status).toBe(500);
    expect(typeof res.body.details).toBe('string');
    expect(res.body.details).not.toMatch(/Argument|foo/);
  });

  it('un Error normal conserva su mensaje legible en details (el frontend lo lee como texto)', async () => {
    jest.spyOn(categoryService, 'getAllCategories').mockRejectedValueOnce(new Error('Falló algo concreto'));

    const res = await ctx.api.get('/api/categories');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener categorías', details: 'Falló algo concreto' });
  });

  it('un valor lanzado que no es un Error produce un texto, nunca un objeto', async () => {
    jest.spyOn(orderService, 'getAllOrders').mockRejectedValueOnce({ raro: true, interno: 'x' });

    const res = await ctx.api.get('/api/orders');
    expect(res.status).toBe(500);
    expect(typeof res.body.details).toBe('string');
    expect(res.body.details).not.toMatch(/raro|interno/);
  });

  it('un id no numérico ya no llega a Prisma: 400 en lugar de un 500 con el objeto de error', async () => {
    const res = await ctx.api.get('/api/orders/abc');
    expect(res.status).toBe(400);
    expect(res.body.details).toBeUndefined();
  });

  it('un fallo a mitad de la creación de una comanda se revierte por completo y no filtra internals', async () => {
    await openCaja(ctx.api);
    const products = (await ctx.api.get('/api/products')).body as any[];
    const burgerId = products.find((p) => p.name === 'Hamburguesa con Queso').id;

    const snapshot = async () => ({
      orders: (await ctx.api.get('/api/orders?scope=all')).body.length,
      sales: (await ctx.api.get('/api/sales')).body.length,
      movements: (await ctx.api.get('/api/inventory/movements')).body.length,
      stocks: ((await ctx.api.get('/api/ingredients')).body as any[]).map((i) => [i.name, i.currentStock]),
    });
    const before = await snapshot();

    // La hamburguesa tiene 3 insumos: se hace fallar el redondeo del tercer cálculo del descuento
    // (después de crear comanda, venta y el primer movimiento), simulando un error a mitad de la transacción.
    const realRound = jest.requireActual('../../src/utils/sale.utils').roundQuantity as (value: number) => number;
    const roundMock = saleUtils.roundQuantity as unknown as jest.Mock;
    let calls = 0;
    roundMock.mockImplementation((value: number) => {
      calls += 1;
      if (calls === 3) throw new Error('FALLO_SIMULADO');
      return realRound(value);
    });

    try {
      const res = await ctx.api.post('/api/orders').send({ items: [{ productId: burgerId, quantity: 1 }] });
      expect(res.status).toBe(500);
      expect(res.body.details).toBe('FALLO_SIMULADO');
    } finally {
      roundMock.mockImplementation(realRound);
    }

    expect(await snapshot()).toEqual(before);

    // Y el sistema sigue funcionando después del fallo
    const ok = await ctx.api.post('/api/orders').send({ items: [{ productId: burgerId, quantity: 1 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.number).toBe('ORD-0001'); // el correlativo del intento fallido no se "gastó"
    await ctx.api.delete(`/api/orders/${ok.body.id}`);
    await closeCaja(ctx.api);
  });
});

describe('B9: el login no distingue mayúsculas', () => {
  it('"admin", "ADMIN" y "Admin" inician sesión como el mismo usuario (se conserva la capitalización guardada)', async () => {
    for (const username of ['admin', 'ADMIN', 'Admin', '  aDmIn  ']) {
      const res = await ctx.api.post('/api/auth/login').send({ username, password: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('Admin');
    }
  });

  it('la contraseña sigue distinguiendo mayúsculas y un usuario inexistente sigue siendo 401', async () => {
    expect((await ctx.api.post('/api/auth/login').send({ username: 'admin', password: '123456x' })).status).toBe(401);
    expect((await ctx.api.post('/api/auth/login').send({ username: 'fantasma', password: '123456' })).status).toBe(401);
  });
});
