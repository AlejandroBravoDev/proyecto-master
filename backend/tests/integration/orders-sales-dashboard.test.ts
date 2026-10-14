import { closeCaja, idByName, openCaja, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

/** Stock actual de un insumo por nombre. */
async function stockOf(name: string): Promise<number> {
  const list = (await ctx.api.get('/api/ingredients')).body as any[];
  return list.find((i) => i.name === name).currentStock;
}

async function productId(name: string): Promise<number> {
  return idByName((await ctx.api.get('/api/products')).body, name);
}

describe('/api/orders (comandas + venta + descuento de stock)', () => {
  let burgerId: number;
  let orderId: number;

  beforeAll(async () => {
    burgerId = await productId('Hamburguesa con Queso');
  });

  it('exige caja abierta: sin turno responde 400 y no guarda nada', async () => {
    const res = await ctx.api.post('/api/orders').send({ items: [{ productId: burgerId, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/caja/i);
    expect((await ctx.api.get('/api/orders?scope=all')).body).toHaveLength(0);
  });

  it('valida el cuerpo: sin items -> 400', async () => {
    await openCaja(ctx.api);
    expect((await ctx.api.post('/api/orders').send({ items: [] })).status).toBe(400);
  });

  it('rechaza producto inexistente o no disponible sin descontar stock', async () => {
    const carneBefore = await stockOf('Carne de Res 150g');

    const ghost = await ctx.api.post('/api/orders').send({ items: [{ productId: 999999, quantity: 1 }] });
    expect(ghost.status).toBe(400);
    expect(ghost.body.error).toContain('999999');

    await ctx.api.put(`/api/products/${burgerId}`).send({ available: false });
    const off = await ctx.api.post('/api/orders').send({ items: [{ productId: burgerId, quantity: 1 }] });
    expect(off.status).toBe(400);
    expect(off.body.error).toContain('Hamburguesa con Queso');
    await ctx.api.put(`/api/products/${burgerId}`).send({ available: true });

    expect(await stockOf('Carne de Res 150g')).toBe(carneBefore);
  });

  it('crea comanda y venta en una transacción, con totales, correlativos y Kardex', async () => {
    const before = {
      pan: await stockOf('Pan de Hamburguesa'),
      carne: await stockOf('Carne de Res 150g'),
      queso: await stockOf('Lámina de Queso Cheddar'),
    };

    const res = await ctx.api.post('/api/orders').send({
      items: [{ productId: burgerId, quantity: 2, notes: 'sin cebolla' }],
      tax: 1,
      discount: 0.5,
      paymentMethod: 'CARD',
    });
    expect(res.status).toBe(201);
    orderId = res.body.id;

    expect(res.body.number).toMatch(/^ORD-\d{4}$/);
    expect(res.body.active).toBe(true);
    expect(res.body.orderDetails).toHaveLength(1);
    expect(res.body.orderDetails[0]).toMatchObject({ quantity: 2, notes: 'sin cebolla' });
    expect(Number(res.body.total)).toBe(15); // 2 x 7.50
    expect(res.body.sale.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(Number(res.body.sale.total)).toBe(15.5); // 15 + 1 - 0.5
    expect(res.body.sale.paymentMethod).toBe('CARD');

    // Receta: 1 pan, 1 carne, 2 queso por hamburguesa x 2
    expect(await stockOf('Pan de Hamburguesa')).toBe(before.pan - 2);
    expect(await stockOf('Carne de Res 150g')).toBe(before.carne - 2);
    expect(await stockOf('Lámina de Queso Cheddar')).toBe(before.queso - 4);

    const moves = (await ctx.api.get('/api/inventory/movements?reason=SALE')).body as any[];
    expect(moves).toHaveLength(3);
    expect(moves.every((m) => m.type === 'OUT' && m.reference === `Order #${res.body.number}`)).toBe(true);
  });

  it('usa unitPrice personalizado cuando viene y es válido', async () => {
    const res = await ctx.api.post('/api/orders').send({ items: [{ productId: burgerId, quantity: 1, unitPrice: 10 }] });
    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(10);
  });

  it('numera consecutivamente las comandas', async () => {
    const list = (await ctx.api.get('/api/orders')).body as any[];
    const numbers = list.map((o) => o.number).sort();
    expect(numbers).toEqual(['ORD-0001', 'ORD-0002']);
  });

  it('GET / por defecto solo trae activas; GET /:id y 404', async () => {
    const active = await ctx.api.get('/api/orders');
    expect(active.body.every((o: any) => o.active)).toBe(true);
    expect(active.body[0].cashSession.sessionNumber).toMatch(/^CAJA-/);

    expect((await ctx.api.get(`/api/orders/${orderId}`)).body.id).toBe(orderId);
    expect((await ctx.api.get('/api/orders/999999')).status).toBe(404);
  });

  it('cerrar caja archiva las comandas activas (scope=all las conserva)', async () => {
    const close = await closeCaja(ctx.api);
    expect(close.status).toBe(200);

    expect((await ctx.api.get('/api/orders')).body).toHaveLength(0);
    expect((await ctx.api.get('/api/orders?scope=all')).body).toHaveLength(2);

    const sessionId = close.body.id;
    expect((await ctx.api.get(`/api/orders?cashSessionId=${sessionId}`)).body).toHaveLength(2);
  });

  it('GET /?date=YYYY-MM-DD filtra por día', async () => {
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect((await ctx.api.get(`/api/orders?date=${ymd}`)).body).toHaveLength(2);
    expect((await ctx.api.get('/api/orders?date=2000-01-01')).body).toHaveLength(0);
  });

  it('DELETE /:id borra la comanda y su venta y devuelve el stock de sus insumos (B7)', async () => {
    const pan = await stockOf('Pan de Hamburguesa');
    const res = await ctx.api.delete(`/api/orders/${orderId}`);
    expect(res.status).toBe(200);
    expect((await ctx.api.get(`/api/orders/${orderId}`)).status).toBe(404);
    expect(await stockOf('Pan de Hamburguesa')).toBe(pan + 2); // la comanda eliminada llevaba 2 hamburguesas
  });
});

describe('/api/sales', () => {
  it('GET / lista ventas con su comanda y detalle', async () => {
    const res = await ctx.api.get('/api/sales');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].saleDetails[0].product).toBeDefined();
  });

  it('GET /:id devuelve la venta o 404', async () => {
    const [first] = (await ctx.api.get('/api/sales')).body;
    expect((await ctx.api.get(`/api/sales/${first.id}`)).status).toBe(200);
    expect((await ctx.api.get('/api/sales/999999')).status).toBe(404);
  });

  it('POST / sin orderId ni items -> 400', async () => {
    expect((await ctx.api.post('/api/sales').send({})).status).toBe(400);
  });

  it('POST / con orderId inexistente -> 404', async () => {
    expect((await ctx.api.post('/api/sales').send({ orderId: 999999 })).status).toBe(404);
  });

  it('POST / con items crea una venta directa sin tocar el stock', async () => {
    const burgerId = await productId('Hamburguesa con Queso');
    const pan = await stockOf('Pan de Hamburguesa');
    const res = await ctx.api.post('/api/sales').send({ items: [{ productId: burgerId, quantity: 3 }] });
    expect(res.status).toBe(201);
    expect(Number(res.body.total)).toBe(22.5);
    expect(await stockOf('Pan de Hamburguesa')).toBe(pan);
  });

  it('POST / valida orderId, ítems, forma de pago e importes (400) y no crea ventas', async () => {
    const burgerId = await productId('Hamburguesa con Queso');
    const valid = [{ productId: burgerId, quantity: 1 }];
    const before = (await ctx.api.get('/api/sales')).body.length;

    const bad: Array<[string, Record<string, unknown>, RegExp?]> = [
      ['orderId no numérico', { orderId: 'abc' }, /orderId/],
      ['producto inexistente', { items: [{ productId: 999999, quantity: 1 }] }, /999999/],
      ['cantidad cero', { items: [{ productId: burgerId, quantity: 0 }] }],
      ['cantidad decimal', { items: [{ productId: burgerId, quantity: 1.5 }] }],
      ['cantidad negativa', { items: [{ productId: burgerId, quantity: -2 }] }],
      ['precio negativo', { items: [{ productId: burgerId, quantity: 1, unitPrice: -2 }] }],
      ['forma de pago inválida', { items: valid, paymentMethod: 'BITCOIN' }, /pago/i],
      ['impuesto negativo', { items: valid, tax: -1 }, /impuesto/i],
      ['descuento no numérico', { items: valid, discount: 'x' }, /descuento/i],
    ];
    for (const [label, body, message] of bad) {
      const res = await ctx.api.post('/api/sales').send(body);
      expect([label, res.status]).toEqual([label, 400]);
      if (message) expect(res.body.error).toMatch(message);
    }
    expect((await ctx.api.get('/api/sales')).body).toHaveLength(before);
  });

  it('POST / con una comanda que ya fue facturada -> 400', async () => {
    const orders = (await ctx.api.get('/api/orders?scope=all')).body as any[];
    const invoiced = orders.find((o) => o.sale);
    const res = await ctx.api.post('/api/sales').send({ orderId: invoiced.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/facturada/i);
  });
});

describe('/api/dashboard/kpis', () => {
  it('devuelve la estructura de KPIs con ingresos coherentes con las ventas del día', async () => {
    const res = await ctx.api.get('/api/dashboard/kpis?period=day');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ period: 'day' });
    expect(res.body).toEqual(
      expect.objectContaining({
        totalRevenue: expect.any(Number),
        totalItemsSold: expect.any(Number),
        grossProfit: expect.any(Number),
        stockAlertsCount: expect.any(Number),
        topSellingProducts: expect.any(Array),
        criticalStockIngredients: expect.any(Array),
      })
    );

    const sales = (await ctx.api.get('/api/sales')).body as any[];
    const expected = sales.reduce((acc, s) => acc + Number(s.total), 0);
    expect(res.body.totalRevenue).toBeCloseTo(expected, 2);
    expect(res.body.topSellingProducts[0].name).toBe('Hamburguesa con Queso');
  });

  it('un period desconocido se calcula como day; month y year también responden', async () => {
    // Un valor desconocido se calcula como "day" (el campo `period` devuelve el texto recibido tal cual)
    const day = (await ctx.api.get('/api/dashboard/kpis?period=day')).body;
    const unknown = (await ctx.api.get('/api/dashboard/kpis?period=siglo')).body;
    expect(unknown.totalRevenue).toBe(day.totalRevenue);
    expect(unknown.totalItemsSold).toBe(day.totalItemsSold);
    expect((await ctx.api.get('/api/dashboard/kpis?period=month')).body.period).toBe('month');
    expect((await ctx.api.get('/api/dashboard/kpis?period=year')).body.period).toBe('year');
  });
});
