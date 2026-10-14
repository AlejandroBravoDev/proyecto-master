/**
 * Stock y comandas (B7) y borrado de productos con historial (B6).
 *
 * - Crear una comanda valida el stock de todos los insumos ANTES de descontar: si alguno no alcanza
 *   responde 400 con el detalle (insumo, necesario y disponible) y no crea ni descuenta nada.
 * - Eliminar una comanda devuelve el stock con movimientos IN compensatorios en el Kardex.
 * - Un producto con comandas o ventas no se elimina (400): se desactiva.
 *
 * Los productos DIRECT_INVENTORY no tienen receta, así que no descuentan ni bloquean por stock.
 */
import { closeCaja, idByName, openCaja, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

const BURGER_INGREDIENTS = ['Pan de Hamburguesa', 'Carne de Res 150g', 'Lámina de Queso Cheddar'];

async function ingredientsList(): Promise<any[]> {
  return (await ctx.api.get('/api/ingredients')).body;
}

async function stockOf(name: string): Promise<number> {
  return (await ingredientsList()).find((i) => i.name === name).currentStock;
}

async function stocks(names: string[] = BURGER_INGREDIENTS): Promise<Record<string, number>> {
  const list = await ingredientsList();
  return Object.fromEntries(names.map((name) => [name, list.find((i) => i.name === name).currentStock]));
}

/** Deja un insumo con un stock exacto usando un ajuste manual (pasa por el Kardex). */
async function setStock(name: string, target: number) {
  const current = await stockOf(name);
  if (current !== target) {
    const res = await ctx.api.put(`/api/ingredients/${idByName(await ingredientsList(), name)}`).send({ adjustStock: target - current });
    expect(res.status).toBe(200);
  }
}

async function productId(name: string): Promise<number> {
  return idByName((await ctx.api.get('/api/products')).body, name);
}

/**
 * Movimientos de Kardex de un insumo, del más antiguo al más reciente.
 * `sinceId` deja solo los creados después de ese id de movimiento (los números de comanda se
 * reutilizan al borrar la última, así que una referencia "Order #ORD-0007" puede repetirse en el tiempo).
 */
async function kardex(name: string, sinceId = 0): Promise<any[]> {
  const id = idByName(await ingredientsList(), name);
  const moves = (await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`)).body as any[];
  return moves.filter((m) => m.id > sinceId).sort((a, b) => a.id - b.id);
}

/** Mayor id de movimiento de Kardex existente (0 si no hay). */
async function lastMovementId(): Promise<number> {
  const moves = (await ctx.api.get('/api/inventory/movements')).body as any[];
  return moves.reduce((max, m) => Math.max(max, m.id), 0);
}

async function counts() {
  return {
    orders: (await ctx.api.get('/api/orders?scope=all')).body.length,
    sales: (await ctx.api.get('/api/sales')).body.length,
    movements: (await ctx.api.get('/api/inventory/movements')).body.length,
  };
}

/** Comprueba que ingredients.current_stock = último new_stock del Kardex de cada insumo. */
async function expectKardexMatchesStock(names: string[] = BURGER_INGREDIENTS) {
  for (const name of names) {
    const moves = await kardex(name);
    expect([name, moves[moves.length - 1].newStock]).toEqual([name, await stockOf(name)]);
  }
}

const createOrder = (items: unknown, extra: Record<string, unknown> = {}) =>
  ctx.api.post('/api/orders').send({ items, ...extra });

describe('B7: stock al crear comandas', () => {
  let burgerId: number;

  beforeAll(async () => {
    await openCaja(ctx.api);
    burgerId = await productId('Hamburguesa con Queso');
  });

  it('si un insumo no alcanza responde 400 con el detalle y no deja nada guardado', async () => {
    await setStock('Carne de Res 150g', 3);
    const carne = (await ingredientsList()).find((i) => i.name === 'Carne de Res 150g');
    const before = { stocks: await stocks(), ...(await counts()) };

    const res = await createOrder([{ productId: burgerId, quantity: 5 }]); // necesita 5 carnes, hay 3
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stock insuficiente/i);
    expect(res.body.error).toContain('Carne de Res 150g');
    expect(res.body.error).toContain('necesario: 5');
    expect(res.body.error).toContain('disponible: 3');
    expect(res.body.shortages).toEqual([
      { ingredientId: carne.id, name: 'Carne de Res 150g', measurementUnit: carne.measurementUnit, needed: 5, available: 3 },
    ]);
    expect(res.body.details).toBeUndefined();

    // ni comanda, ni venta, ni movimientos, ni stock descontado
    expect({ stocks: await stocks(), ...(await counts()) }).toEqual(before);
  });

  it('lista todos los insumos que faltan, no solo el primero', async () => {
    await setStock('Pan de Hamburguesa', 1);
    await setStock('Carne de Res 150g', 3);

    const res = await createOrder([{ productId: burgerId, quantity: 5 }]);
    expect(res.status).toBe(400);
    const names = res.body.shortages.map((s: any) => s.name).sort();
    expect(names).toEqual(['Carne de Res 150g', 'Pan de Hamburguesa']);
    expect(res.body.error).toContain('Pan de Hamburguesa');
    expect(res.body.error).toContain('Carne de Res 150g');
    expect(res.body.error).not.toContain('Cheddar'); // el queso sí alcanza
  });

  it('con el stock justo la comanda se crea y el insumo queda en 0 con su Kardex', async () => {
    await setStock('Pan de Hamburguesa', 100);
    await setStock('Carne de Res 150g', 3);
    await setStock('Lámina de Queso Cheddar', 150);

    const res = await createOrder([{ productId: burgerId, quantity: 3 }]);
    expect(res.status).toBe(201);
    expect(await stocks()).toEqual({ 'Pan de Hamburguesa': 97, 'Carne de Res 150g': 0, 'Lámina de Queso Cheddar': 144 });

    const carne = await kardex('Carne de Res 150g');
    expect(carne[carne.length - 1]).toMatchObject({ type: 'OUT', reason: 'SALE', quantity: 3, previousStock: 3, newStock: 0, reference: `Order #${res.body.number}` });
    await expectKardexMatchesStock();
  });

  it('ya sin stock, una unidad más responde 400 con disponible 0', async () => {
    const res = await createOrder([{ productId: burgerId, quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.shortages).toEqual([expect.objectContaining({ name: 'Carne de Res 150g', needed: 1, available: 0 })]);
  });

  it('un mismo insumo en varias líneas se suma al validar y el Kardex encadena los stocks', async () => {
    await setStock('Carne de Res 150g', 5);
    const before = { stocks: await stocks(), ...(await counts()) };

    // cada línea sola alcanza (3 <= 5) pero juntas no (6 > 5)
    const tooMuch = await createOrder([
      { productId: burgerId, quantity: 3 },
      { productId: burgerId, quantity: 3 },
    ]);
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.shortages).toEqual([expect.objectContaining({ name: 'Carne de Res 150g', needed: 6, available: 5 })]);
    expect({ stocks: await stocks(), ...(await counts()) }).toEqual(before);

    // dos líneas que sí alcanzan: antes se calculaba cada una con el stock viejo y el Kardex no cuadraba
    const since = await lastMovementId();
    const ok = await createOrder([
      { productId: burgerId, quantity: 2 },
      { productId: burgerId, quantity: 3 },
    ]);
    expect(ok.status).toBe(201);
    expect((await stocks())['Carne de Res 150g']).toBe(0);

    const mine = (await kardex('Carne de Res 150g', since)).filter((m) => m.reference === `Order #${ok.body.number}`);
    expect(mine.map((m) => [m.quantity, m.previousStock, m.newStock])).toEqual([
      [2, 5, 3],
      [3, 3, 0],
    ]);
    await expectKardexMatchesStock();
  });

  it('los productos sin receta (venta directa) no descuentan stock ni se bloquean por stock', async () => {
    const gaseosaId = await productId('Gaseosa 350ml');
    const before = await stocks();
    const res = await createOrder([{ productId: gaseosaId, quantity: 500 }]);
    expect(res.status).toBe(201);
    expect(await stocks()).toEqual(before);
  });

  it('redondea el descuento de recetas con decimales sin ruido de coma flotante', async () => {
    const cats = (await ctx.api.get('/api/categories')).body;
    const salt = await ctx.api.post('/api/ingredients').send({ name: 'Sal fina', measurementUnit: 'kg', currentStock: 10 });
    const dish = await ctx.api.post('/api/products').send({
      categoryId: idByName(cats, 'Hamburguesas'),
      name: 'Plato salado',
      salePrice: 2,
      recipe: { ingredients: [{ ingredientId: salt.body.id, quantity: 0.1 }] },
    });
    expect(dish.status).toBe(201);

    const res = await createOrder([{ productId: dish.body.id, quantity: 3 }]); // 0.1 * 3 = 0.30000000000000004
    expect(res.status).toBe(201);
    expect(await stockOf('Sal fina')).toBe(9.7);
    const moves = await kardex('Sal fina');
    expect(moves[moves.length - 1]).toMatchObject({ type: 'OUT', quantity: 0.3, previousStock: 10, newStock: 9.7 });
    await ctx.api.delete(`/api/orders/${res.body.id}`); // devuelve el stock y libera el producto
  });

  it('rechaza renglones mal formados (400) sin descontar ni sumar stock', async () => {
    const before = { stocks: await stocks(), ...(await counts()) };
    const badItems: Array<[string, unknown]> = [
      ['cantidad cero', [{ productId: burgerId, quantity: 0 }]],
      ['cantidad negativa (sumaría stock)', [{ productId: burgerId, quantity: -5 }]],
      ['cantidad decimal', [{ productId: burgerId, quantity: 1.5 }]],
      ['cantidad no numérica', [{ productId: burgerId, quantity: 'mucho' }]],
      ['productId no numérico', [{ productId: 'abc', quantity: 1 }]],
      ['productId cero', [{ productId: 0, quantity: 1 }]],
      ['renglón nulo', [null]],
    ];
    for (const [label, items] of badItems) {
      const res = await createOrder(items);
      expect([label, res.status]).toEqual([label, 400]);
      expect(typeof res.body.error).toBe('string');
    }
    expect({ stocks: await stocks(), ...(await counts()) }).toEqual(before);
  });

  it('rechaza forma de pago, impuesto o descuento inválidos (400)', async () => {
    await setStock('Carne de Res 150g', 20);
    const item = [{ productId: burgerId, quantity: 1 }];
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ paymentMethod: 'BITCOIN' }, /pago/i],
      [{ tax: -1 }, /impuesto/i],
      [{ discount: 'mucho' }, /descuento/i],
    ];
    for (const [extra, message] of cases) {
      const res = await createOrder(item, extra);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
    }
  });
});

describe('B7: devolución de stock al eliminar una comanda', () => {
  let burgerId: number;

  beforeAll(async () => {
    burgerId = await productId('Hamburguesa con Queso');
    await setStock('Pan de Hamburguesa', 100);
    await setStock('Carne de Res 150g', 80);
    await setStock('Lámina de Queso Cheddar', 150);
  });

  it('devuelve el stock con movimientos IN compensatorios (MANUAL_ADJUSTMENT, "Anulación Order #...") en el Kardex', async () => {
    const before = await stocks();
    const since = await lastMovementId();
    const created = await createOrder([{ productId: burgerId, quantity: 2 }]);
    expect(created.status).toBe(201);
    const number: string = created.body.number;
    const afterSale = await stocks();
    expect(afterSale).toEqual({ 'Pan de Hamburguesa': 98, 'Carne de Res 150g': 78, 'Lámina de Queso Cheddar': 146 });

    const res = await ctx.api.delete(`/api/orders/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(await stocks()).toEqual(before);

    const expected: Array<[string, number]> = [
      ['Pan de Hamburguesa', 2],
      ['Carne de Res 150g', 2],
      ['Lámina de Queso Cheddar', 4],
    ];
    for (const [name, quantity] of expected) {
      const moves = await kardex(name, since);
      const compensation = moves.filter((m) => m.reference === `Anulación Order #${number}`);
      expect(compensation).toHaveLength(1);
      expect(compensation[0]).toMatchObject({
        type: 'IN',
        reason: 'MANUAL_ADJUSTMENT',
        quantity,
        previousStock: afterSale[name],
        newStock: before[name],
      });
      // el Kardex es append-only: la salida original sigue ahí
      expect(moves.filter((m) => m.reference === `Order #${number}` && m.type === 'OUT' && m.reason === 'SALE')).toHaveLength(1);
    }
    await expectKardexMatchesStock();
  });

  it('devuelve lo que realmente salió aunque la receta haya cambiado después de la venta', async () => {
    // (los ids se resuelven antes de armar cada petición: supertest comparte un servidor y una
    // petición intercalada entre crear y enviar otra lo cierra)
    const cats = (await ctx.api.get('/api/categories')).body;
    const ingredients = await ingredientsList();
    const panId = idByName(ingredients, 'Pan de Hamburguesa');
    const carneId = idByName(ingredients, 'Carne de Res 150g');
    const dish = await ctx.api.post('/api/products').send({
      categoryId: idByName(cats, 'Postres'),
      name: 'Plato cambiante',
      salePrice: 5,
      recipe: { ingredients: [{ ingredientId: panId, quantity: 1 }] },
    });
    const before = await stocks();
    const order = await createOrder([{ productId: dish.body.id, quantity: 2 }]);
    expect((await stocks())['Pan de Hamburguesa']).toBe(before['Pan de Hamburguesa'] - 2);

    // la receta cambia: ahora lleva 5 carnes por unidad
    const swap = await ctx.api.post('/api/recipes').send({
      productId: dish.body.id,
      ingredients: [{ ingredientId: carneId, quantity: 5 }],
    });
    expect(swap.status).toBe(201);

    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(200);
    expect(await stocks()).toEqual(before); // el pan vuelve; la carne no se toca
    await ctx.api.delete(`/api/products/${dish.body.id}`);
  });

  it('las líneas con el mismo insumo se devuelven agregadas en un solo movimiento', async () => {
    const before = await stocks();
    const since = await lastMovementId();
    const order = await createOrder([
      { productId: burgerId, quantity: 2 },
      { productId: burgerId, quantity: 3 },
    ]);
    expect((await stocks())['Carne de Res 150g']).toBe(before['Carne de Res 150g'] - 5);

    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(200);
    expect(await stocks()).toEqual(before);

    const compensation = (await kardex('Carne de Res 150g', since)).filter((m) => m.reference === `Anulación Order #${order.body.number}`);
    expect(compensation).toHaveLength(1);
    expect(compensation[0]).toMatchObject({ type: 'IN', quantity: 5 });
    await expectKardexMatchesStock();
  });

  it('si el número de comanda se reutiliza tras borrar la última, no se devuelve stock de más', async () => {
    const before = await stocks();
    const since = await lastMovementId();

    const first = await createOrder([{ productId: burgerId, quantity: 1 }]);
    expect((await ctx.api.delete(`/api/orders/${first.body.id}`)).status).toBe(200);
    expect(await stocks()).toEqual(before);

    // los correlativos se calculan sobre las filas existentes: la nueva comanda hereda el número borrado
    const second = await createOrder([{ productId: burgerId, quantity: 3 }]);
    expect(second.body.number).toBe(first.body.number);
    expect((await stocks())['Carne de Res 150g']).toBe(before['Carne de Res 150g'] - 3);

    expect((await ctx.api.delete(`/api/orders/${second.body.id}`)).status).toBe(200);
    expect(await stocks()).toEqual(before); // si sumara también lo de la primera, sobraría 1

    const compensation = (await kardex('Carne de Res 150g', since))
      .filter((m) => m.reference === `Anulación Order #${first.body.number}`)
      .map((m) => m.quantity);
    expect(compensation).toEqual([1, 3]);
    await expectKardexMatchesStock();
  });

  it('una comanda archivada (caja ya cerrada) también devuelve el stock', async () => {
    const before = await stocks();
    const order = await createOrder([{ productId: burgerId, quantity: 2 }]);
    expect((await closeCaja(ctx.api)).status).toBe(200);
    expect((await ctx.api.get(`/api/orders/${order.body.id}`)).body.active).toBe(false);

    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(200);
    expect(await stocks()).toEqual(before);
    await openCaja(ctx.api);
  });

  it('una comanda de productos sin receta se elimina sin crear movimientos', async () => {
    const gaseosaId = await productId('Gaseosa 350ml');
    const order = await createOrder([{ productId: gaseosaId, quantity: 2 }]);
    const before = await counts();

    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(200);
    expect(await counts()).toEqual({ ...before, orders: before.orders - 1, sales: before.sales - 1 });
  });

  it('eliminar una comanda inexistente responde 404 y no toca nada', async () => {
    const before = { stocks: await stocks(), ...(await counts()) };
    const res = await ctx.api.delete('/api/orders/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no encontrada/i);
    expect({ stocks: await stocks(), ...(await counts()) }).toEqual(before);
  });

  it('eliminar la misma comanda dos veces no devuelve stock la segunda vez', async () => {
    const order = await createOrder([{ productId: burgerId, quantity: 1 }]);
    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(200);
    const afterFirst = await stocks();
    expect((await ctx.api.delete(`/api/orders/${order.body.id}`)).status).toBe(404);
    expect(await stocks()).toEqual(afterFirst);
  });
});

describe('B6: borrar productos con historial', () => {
  let categoryId: number;
  let comboId: number;
  let orderId: number;

  beforeAll(async () => {
    categoryId = idByName((await ctx.api.get('/api/categories')).body, 'Postres');
  });

  it('un producto con comandas no se elimina: 400 con mensaje claro y el historial queda intacto', async () => {
    const combo = await ctx.api.post('/api/products').send({ categoryId, name: 'Combo histórico', salePrice: 4, productType: 'DIRECT_INVENTORY' });
    comboId = combo.body.id;
    const order = await createOrder([{ productId: comboId, quantity: 2 }]);
    expect(order.status).toBe(201);
    orderId = order.body.id;

    const res = await ctx.api.delete(`/api/products/${comboId}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/historial/i);
    expect(res.body.error).toMatch(/desactívalo en lugar de eliminarlo/i);
    expect(res.body.details).toBeUndefined();

    expect((await ctx.api.get(`/api/products/${comboId}`)).status).toBe(200);
    const detail = (await ctx.api.get(`/api/orders/${orderId}`)).body;
    expect(detail.orderDetails).toHaveLength(1);
    expect(detail.orderDetails[0]).toMatchObject({ productId: comboId, quantity: 2 });
    const sales = (await ctx.api.get('/api/sales')).body as any[];
    const sale = sales.find((s) => s.orderId === orderId);
    expect(sale.saleDetails).toHaveLength(1);
    expect(sale.saleDetails[0].product.name).toBe('Combo histórico');
    expect(Number(sale.total)).toBe(8);
  });

  it('desactivarlo (available = false) sí es posible y deja de venderse', async () => {
    const off = await ctx.api.put(`/api/products/${comboId}`).send({ available: false });
    expect(off.status).toBe(200);
    expect(off.body.available).toBe(false);

    const blocked = await createOrder([{ productId: comboId, quantity: 1 }]);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/no está disponible/i);
  });

  it('una venta directa (POST /api/sales con items) también cuenta como historial', async () => {
    const product = await ctx.api.post('/api/products').send({ categoryId, name: 'Combo vendido', salePrice: 3 });
    const sale = await ctx.api.post('/api/sales').send({ items: [{ productId: product.body.id, quantity: 1 }] });
    expect(sale.status).toBe(201);

    const res = await ctx.api.delete(`/api/products/${product.body.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/historial/i);
    expect((await ctx.api.get(`/api/products/${product.body.id}`)).status).toBe(200);
  });

  it('un producto sin historial se elimina junto con su receta (sin recetas huérfanas)', async () => {
    const ingredients = await ingredientsList();
    const product = await ctx.api.post('/api/products').send({
      categoryId,
      name: 'Efímero',
      salePrice: 1,
      recipe: { ingredients: [{ ingredientId: idByName(ingredients, 'Pan de Hamburguesa'), quantity: 1 }] },
    });
    expect(product.body.recipe).toBeTruthy();

    expect((await ctx.api.delete(`/api/products/${product.body.id}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/products/${product.body.id}`)).status).toBe(404);
    expect((await ctx.api.get(`/api/recipes/product/${product.body.id}`)).status).toBe(404);
    const recipes = (await ctx.api.get('/api/recipes')).body as any[];
    expect(recipes.some((r) => r.productId === product.body.id)).toBe(false);
  });

  it('al eliminar la comanda el producto queda sin historial y ya se puede borrar (B6 + B7)', async () => {
    expect((await ctx.api.delete(`/api/orders/${orderId}`)).status).toBe(200);
    expect((await ctx.api.delete(`/api/products/${comboId}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/products/${comboId}`)).status).toBe(404);
  });
});
