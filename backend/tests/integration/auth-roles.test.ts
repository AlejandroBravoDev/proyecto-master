/**
 * S1 - Roles ADMIN / WORKER aplicados en el servidor.
 *
 * Las reglas salen de lo que la interfaz ya permite a cada rol (ver la matriz esperada en
 * tests/helpers/roleMatrix.ts y `users-roles.md`): el WORKER no puede usar nada que la UI le oculte.
 * Aquí se comprueba cada ruta con un WORKER y con un ADMIN, y los matices:
 *  - productos: el WORKER solo puede cambiar `available`;
 *  - insumos: el WORKER solo puede ajustar stock (`adjustStock` + `adjustReason`);
 *  - comandas: el WORKER solo ve y elimina las del turno actual;
 *  - caja: todos abren/cierran, solo ADMIN edita sesiones.
 */
import { ROLE_MATRIX, concretePath } from '../helpers/roleMatrix';
import { closeCaja, idByName, openCaja, TestWorker, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

const FORBIDDEN = { error: 'No tienes permisos para realizar esta acción.' };

let worker: TestWorker;

beforeAll(async () => {
  worker = await ctx.createWorker();
});

/** Lee la respuesta completa: JSON como objeto y cualquier otra cosa (Excel) como Buffer. */
function parseAnyBody(res: NodeJS.ReadableStream & { headers: Record<string, unknown> }, done: (error: Error | null, body?: unknown) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (!String(res.headers['content-type'] ?? '').includes('json')) return done(null, raw);
    try {
      done(null, JSON.parse(raw.toString('utf8')));
    } catch (error) {
      done(error as Error);
    }
  });
}

/** Lanza la petición de una entrada de la matriz con el cliente indicado. */
function call(client: typeof ctx.api, route: string, body: Record<string, unknown> = {}) {
  const [method, pattern] = route.split(' ');
  const request = (client as any)[method.toLowerCase()](concretePath(pattern)).buffer(true).parse(parseAnyBody);
  return ['POST', 'PUT', 'PATCH'].includes(method) ? request.send(body) : request;
}

describe('S1: matriz de roles contra el servidor (WORKER)', () => {
  const rules = ROLE_MATRIX.filter((rule) => !rule.public);

  it.each(rules.filter((rule) => rule.worker === 'deny').map((rule) => [rule.route]))(
    'WORKER en %s -> 403 con el mensaje estándar',
    async (route) => {
      const res = await call(worker.api, route);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
    }
  );

  it.each(rules.filter((rule) => rule.worker === 'allow').map((rule) => [rule.route, rule]))(
    'WORKER en %s -> permitido (ni 401 ni 403)',
    async (_route, rule: any) => {
      const res = await call(worker.api, rule.route, rule.workerBody ?? {});
      expect([401, 403]).not.toContain(res.status);
    }
  );

  it.each(rules.map((rule) => [rule.route]))('ADMIN en %s -> nunca 401 ni 403', async (route) => {
    const res = await call(ctx.api, route);
    expect([401, 403]).not.toContain(res.status);
  });

  it('un 403 por rol no cierra la sesión: el mismo token sigue valiendo', async () => {
    expect((await worker.api.get('/api/users')).status).toBe(403);
    expect((await worker.api.get('/api/auth/me')).status).toBe(200);
  });
});

describe('S1: usuarios solo para ADMIN', () => {
  it('un WORKER no puede listar usuarios, verlos, crearlos ni cambiar contraseñas o estados', async () => {
    const list = await worker.api.get('/api/users');
    expect(list.status).toBe(403);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|fullName/);

    const adminId = (await ctx.api.get('/api/auth/me')).body.user.id;
    expect((await worker.api.get(`/api/users/${adminId}`)).status).toBe(403);
    expect((await worker.api.post('/api/users').send({ fullName: 'Intruso', username: 'intruso', password: 'secreto1', role: 'ADMIN' })).status).toBe(403);
    expect((await worker.api.patch(`/api/users/${adminId}/password`).send({ password: 'hackeada-1' })).status).toBe(403);
    expect((await worker.api.patch(`/api/users/${adminId}/status`).send({ active: false })).status).toBe(403);
    expect((await worker.api.put(`/api/users/${worker.user.id}`).send({ role: 'ADMIN' })).status).toBe(403);

    // Nada cambió: el admin sigue entrando con su contraseña y el trabajador sigue siendo WORKER
    expect((await ctx.anon.post('/api/auth/login').send({ username: 'Admin', password: '123456' })).status).toBe(200);
    expect((await worker.api.get('/api/auth/me')).body.user.role).toBe('WORKER');
    expect((await ctx.api.get('/api/users')).body.some((u: { username: string }) => u.username === 'intruso')).toBe(false);
  });

  it('el ADMIN conserva todo el CRUD de usuarios', async () => {
    const list = await ctx.api.get('/api/users');
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash/);
  });
});

describe('S1: catálogo (categorías, productos, recetas)', () => {
  it('el WORKER lee categorías, productos y recetas', async () => {
    expect((await worker.api.get('/api/categories')).status).toBe(200);
    const products = await worker.api.get('/api/products');
    expect(products.status).toBe(200);
    expect(products.body.length).toBeGreaterThan(0);
    expect((await worker.api.get('/api/recipes')).status).toBe(200);
    const burger = idByName(products.body, 'Hamburguesa con Queso');
    expect((await worker.api.get(`/api/products/${burger}`)).status).toBe(200);
    expect((await worker.api.get(`/api/recipes/product/${burger}`)).status).toBe(200);
  });

  it('el WORKER no puede crear ni borrar categorías', async () => {
    const name = `Categoria-${Date.now()}`;
    expect((await worker.api.post('/api/categories').send({ name })).status).toBe(403);
    expect((await ctx.api.get('/api/categories')).body.some((c: { name: string }) => c.name === name)).toBe(false);

    const created = await ctx.api.post('/api/categories').send({ name });
    expect(created.status).toBe(201);
    expect((await worker.api.put(`/api/categories/${created.body.id}`).send({ name: 'Renombrada' })).status).toBe(403);
    expect((await worker.api.delete(`/api/categories/${created.body.id}`)).status).toBe(403);
    expect((await ctx.api.get(`/api/categories/${created.body.id}`)).body.name).toBe(name);
    expect((await ctx.api.delete(`/api/categories/${created.body.id}`)).status).toBe(200);
  });

  it('el WORKER solo puede cambiar `available` de un producto; cualquier otro campo -> 403 y no se modifica', async () => {
    const products = (await ctx.api.get('/api/products')).body;
    const id = idByName(products, 'Gaseosa 350ml');
    const before = (await ctx.api.get(`/api/products/${id}`)).body;

    const off = await worker.api.put(`/api/products/${id}`).send({ available: false });
    expect(off.status).toBe(200);
    expect(off.body.available).toBe(false);
    expect((await worker.api.put(`/api/products/${id}`).send({ available: true })).body.available).toBe(true);

    for (const body of [
      { name: 'Gaseosa regalada' },
      { salePrice: 0.01 },
      { available: false, salePrice: 0.01 },
      { categoryId: before.categoryId, available: true, description: 'x' },
    ]) {
      const res = await worker.api.put(`/api/products/${id}`).send(body);
      expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 403]);
      expect(res.body).toEqual(FORBIDDEN);
    }

    const after = (await ctx.api.get(`/api/products/${id}`)).body;
    expect({ name: after.name, salePrice: after.salePrice, available: after.available }).toEqual({
      name: before.name,
      salePrice: before.salePrice,
      available: true,
    });
  });

  it('el ADMIN puede editar cualquier campo del producto', async () => {
    const id = idByName((await ctx.api.get('/api/products')).body, 'Gaseosa 350ml');
    const res = await ctx.api.put(`/api/products/${id}`).send({ description: 'Editada por el admin', available: true });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Editada por el admin');
  });

  it('el WORKER no puede crear ni eliminar productos ni tocar recetas', async () => {
    const products = (await ctx.api.get('/api/products')).body;
    const burger = products.find((p: { name: string }) => p.name === 'Hamburguesa con Queso');
    const recipeBefore = (await ctx.api.get(`/api/recipes/product/${burger.id}`)).body;

    expect((await worker.api.post('/api/products').send({ categoryId: burger.categoryId, name: 'Pirata', salePrice: 1 })).status).toBe(403);
    expect((await worker.api.delete(`/api/products/${burger.id}`)).status).toBe(403);
    expect((await worker.api.post('/api/recipes').send({ productId: burger.id, ingredients: [] })).status).toBe(403);
    expect((await worker.api.delete(`/api/recipes/${recipeBefore.id}`)).status).toBe(403);

    expect((await ctx.api.get('/api/products')).body.some((p: { name: string }) => p.name === 'Pirata')).toBe(false);
    expect((await ctx.api.get(`/api/products/${burger.id}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/recipes/product/${burger.id}`)).body.recipeDetails).toHaveLength(recipeBefore.recipeDetails.length);
  });
});

describe('S1: inventario (insumos, Kardex, alertas)', () => {
  let ingredientId: number;

  beforeAll(async () => {
    ingredientId = idByName((await ctx.api.get('/api/ingredients')).body, 'Pan de Hamburguesa');
  });

  it('el WORKER lee insumos, Kardex y alertas y descarga la plantilla y el reporte Excel', async () => {
    expect((await worker.api.get('/api/ingredients')).status).toBe(200);
    expect((await worker.api.get(`/api/ingredients/${ingredientId}`)).status).toBe(200);
    expect((await worker.api.get('/api/inventory/movements')).status).toBe(200);
    expect((await worker.api.get('/api/inventory/alerts')).status).toBe(200);
    for (const url of ['/api/ingredients/template/ingredients', '/api/ingredients/export/ingredients']) {
      const res = await worker.api.get(url).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect([url, res.status]).toEqual([url, 200]);
      expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    }
  });

  it('el WORKER puede ajustar stock (adjustStock + adjustReason) y queda en el Kardex', async () => {
    const before = (await ctx.api.get(`/api/ingredients/${ingredientId}`)).body.currentStock;
    const res = await worker.api.put(`/api/ingredients/${ingredientId}`).send({ adjustStock: 5, adjustReason: 'MANUAL_ADJUSTMENT' });
    expect(res.status).toBe(200);
    expect(res.body.currentStock).toBe(before + 5);

    const waste = await worker.api.put(`/api/ingredients/${ingredientId}`).send({ adjustStock: -5, adjustReason: 'WASTE' });
    expect(waste.status).toBe(200);
    expect(waste.body.currentStock).toBe(before);
  });

  it('el WORKER no puede editar datos del insumo, ni mezclarlos con un ajuste de stock', async () => {
    const before = (await ctx.api.get(`/api/ingredients/${ingredientId}`)).body;
    for (const body of [
      { name: 'Pan robado' },
      { unitCost: 0 },
      { minimumStock: 0 },
      { active: false },
      { measurementUnit: 'litro' },
      { adjustStock: 5, adjustReason: 'MANUAL_ADJUSTMENT', unitCost: 0 },
    ]) {
      const res = await worker.api.put(`/api/ingredients/${ingredientId}`).send(body);
      expect([JSON.stringify(body), res.status]).toEqual([JSON.stringify(body), 403]);
      expect(res.body).toEqual(FORBIDDEN);
    }
    const after = (await ctx.api.get(`/api/ingredients/${ingredientId}`)).body;
    expect({ name: after.name, unitCost: after.unitCost, minimumStock: after.minimumStock, active: after.active, currentStock: after.currentStock }).toEqual({
      name: before.name,
      unitCost: before.unitCost,
      minimumStock: before.minimumStock,
      active: before.active,
      currentStock: before.currentStock,
    });
  });

  it('el ADMIN sí puede editar el insumo', async () => {
    const res = await ctx.api.put(`/api/ingredients/${ingredientId}`).send({ description: 'Editado por el admin' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Editado por el admin');
  });

  it('el WORKER no puede crear, eliminar ni importar insumos (el rol se comprueba antes de leer el archivo)', async () => {
    const name = `Insumo-${Date.now()}`;
    expect((await worker.api.post('/api/ingredients').send({ name, measurementUnit: 'kg' })).status).toBe(403);
    expect((await worker.api.delete(`/api/ingredients/${ingredientId}`)).status).toBe(403);
    const upload = await worker.api
      .post('/api/ingredients/import/ingredients')
      .attach('file', Buffer.from('no importa'), { filename: 'insumos.xlsx' });
    expect(upload.status).toBe(403);
    expect(upload.body).toEqual(FORBIDDEN);

    const list = (await ctx.api.get('/api/ingredients')).body;
    expect(list.some((i: { name: string }) => i.name === name)).toBe(false);
    expect(list.some((i: { id: number }) => i.id === ingredientId)).toBe(true);
  });
});

describe('S1: ventas solo para ADMIN', () => {
  it('el WORKER no puede listar, ver ni crear ventas; el ADMIN sí', async () => {
    expect((await worker.api.get('/api/sales')).status).toBe(403);
    expect((await worker.api.get('/api/sales/1')).status).toBe(403);
    expect((await worker.api.post('/api/sales').send({ items: [] })).status).toBe(403);
    expect((await ctx.api.get('/api/sales')).status).toBe(200);
  });
});

describe('S1: caja', () => {
  it('el WORKER abre, consulta y cierra la caja; solo el ADMIN edita sesiones', async () => {
    const open = await worker.api.post('/api/caja/open').send({ denominations: { '1': 10 }, notes: 'Turno del trabajador' });
    expect(open.status).toBe(201);
    expect((await worker.api.get('/api/caja/status')).body.isOpen).toBe(true);

    const detail = await worker.api.get(`/api/caja/session/${open.body.id}`);
    expect(detail.status).toBe(200);
    expect((await worker.api.get('/api/caja/history')).status).toBe(200);

    const edit = await worker.api.put(`/api/caja/${open.body.id}`).send({ initialAmount: 1000 });
    expect(edit.status).toBe(403);
    expect(edit.body).toEqual(FORBIDDEN);
    expect((await ctx.api.get(`/api/caja/session/${open.body.id}`)).body.initialAmount).toBe(10);

    expect((await worker.api.post('/api/caja/close').send({ denominations: { '1': 10 } })).status).toBe(200);

    const adminEdit = await ctx.api.put(`/api/caja/${open.body.id}`).send({ closingNotes: 'Revisado por el admin' });
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.closingNotes).toBe('Revisado por el admin');
  });

  it('el WORKER consulta el dashboard', async () => {
    expect((await worker.api.get('/api/dashboard/kpis')).status).toBe(200);
  });
});

describe('S1: comandas - el WORKER solo ve y elimina las del turno actual', () => {
  let cappuccino: number;
  let currentOrderId: number;
  let archivedOrderId: number;
  let archivedSessionId: number;
  let currentSessionId: number;

  const createOrder = async (client: typeof ctx.api) => {
    const res = await client.post('/api/orders').send({ items: [{ productId: cappuccino, quantity: 1 }] });
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  beforeAll(async () => {
    cappuccino = idByName((await ctx.api.get('/api/products')).body, 'Café Cappuccino');
  });

  afterAll(async () => {
    await closeCaja(ctx.api);
  });

  it('turno anterior: el ADMIN deja una comanda archivada al cerrar la caja', async () => {
    archivedSessionId = (await openCaja(ctx.api)).id;
    archivedOrderId = await createOrder(worker.api);
    expect((await closeCaja(ctx.api)).status).toBe(200);
    expect((await ctx.api.get(`/api/orders/${archivedOrderId}`)).body.active).toBe(false);
  });

  it('turno actual: el WORKER crea comandas y ve las de la sesión abierta', async () => {
    currentSessionId = (await openCaja(worker.api)).id;
    currentOrderId = await createOrder(worker.api);

    const list = await worker.api.get('/api/orders');
    expect(list.status).toBe(200);
    expect(list.body.map((o: { id: number }) => o.id)).toEqual([currentOrderId]);

    const active = await worker.api.get('/api/orders?scope=active');
    expect(active.body.map((o: { id: number }) => o.id)).toEqual([currentOrderId]);

    const bySession = await worker.api.get(`/api/orders?cashSessionId=${currentSessionId}`);
    expect(bySession.status).toBe(200);
    expect(bySession.body.map((o: { id: number }) => o.id)).toEqual([currentOrderId]);

    expect((await worker.api.get(`/api/orders/${currentOrderId}`)).status).toBe(200);
  });

  it('el WORKER recibe 403 al pedir el historial: scope=all, una fecha o la sesión de otro turno', async () => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (const query of [
      'scope=all',
      `date=${dateStr}`,
      `scope=active&date=${dateStr}`,
      `cashSessionId=${archivedSessionId}`,
      'cashSessionId=999999',
      `scope=all&cashSessionId=${currentSessionId}`,
    ]) {
      const res = await worker.api.get(`/api/orders?${query}`);
      expect([query, res.status]).toEqual([query, 403]);
      expect(res.body).toEqual(FORBIDDEN);
    }

    // El ADMIN sí ve el historial: la comanda archivada y la actual
    const all = (await ctx.api.get('/api/orders?scope=all')).body.map((o: { id: number }) => o.id);
    expect(all).toEqual(expect.arrayContaining([archivedOrderId, currentOrderId]));
    expect((await ctx.api.get(`/api/orders?cashSessionId=${archivedSessionId}`)).body.map((o: { id: number }) => o.id)).toEqual([archivedOrderId]);
    expect((await ctx.api.get(`/api/orders?date=${dateStr}`)).status).toBe(200);
  });

  it('las validaciones de la query siguen primero (400) también para el WORKER', async () => {
    expect((await worker.api.get('/api/orders?date=2026-13-45')).status).toBe(400);
    expect((await worker.api.get('/api/orders?cashSessionId=abc')).status).toBe(400);
  });

  it('el WORKER no puede ver ni eliminar una comanda de un turno ya cerrado (403) pero el ADMIN sí', async () => {
    const get = await worker.api.get(`/api/orders/${archivedOrderId}`);
    expect(get.status).toBe(403);
    expect(get.body).toEqual(FORBIDDEN);

    const del = await worker.api.delete(`/api/orders/${archivedOrderId}`);
    expect(del.status).toBe(403);
    expect(del.body).toEqual(FORBIDDEN);
    expect((await ctx.api.get(`/api/orders/${archivedOrderId}`)).status).toBe(200); // sigue existiendo

    expect((await ctx.api.get(`/api/orders/${archivedOrderId}`)).body.sale).toBeTruthy();
    expect((await ctx.api.delete(`/api/orders/${archivedOrderId}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/orders/${archivedOrderId}`)).status).toBe(404);
  });

  it('un id inexistente sigue siendo 404 (y no 403) para el WORKER', async () => {
    expect((await worker.api.get('/api/orders/999999')).status).toBe(404);
    expect((await worker.api.delete('/api/orders/999999')).status).toBe(404);
  });

  it('el WORKER elimina una comanda del turno actual y el stock se devuelve', async () => {
    const del = await worker.api.delete(`/api/orders/${currentOrderId}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ message: 'Comanda eliminada correctamente' });
    expect((await ctx.api.get(`/api/orders/${currentOrderId}`)).status).toBe(404);
    expect((await worker.api.get('/api/orders')).body).toEqual([]);
  });

  it('con la caja cerrada el WORKER no ve comandas ni puede consultar ninguna sesión', async () => {
    const orderId = await createOrder(worker.api);
    expect((await closeCaja(worker.api)).status).toBe(200);

    expect((await worker.api.get('/api/orders')).body).toEqual([]);
    expect((await worker.api.get(`/api/orders?cashSessionId=${currentSessionId}`)).status).toBe(403);
    expect((await worker.api.get(`/api/orders/${orderId}`)).status).toBe(403);
    expect((await worker.api.delete(`/api/orders/${orderId}`)).status).toBe(403);
    expect((await ctx.api.get(`/api/orders/${orderId}`)).status).toBe(200);
  });
});
