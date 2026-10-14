import ExcelJS from 'exceljs';
import { idByName, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

const IMPORT_HEADERS = [
  'Nombre del Insumo',
  'Descripción',
  'Unidad de Medida',
  'Stock Inicial',
  'Stock Mínimo',
  'Costo Unitario',
];

/** Arma un .xlsx en memoria con los encabezados de la plantilla oficial. */
async function buildXlsx(rows: Array<Array<string | number | null>>, headers: string[] = IMPORT_HEADERS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Insumos');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('/api/ingredients (CRUD y Kardex)', () => {
  let id: number;

  it('POST / con stock inicial crea el insumo y un movimiento IN/PURCHASE', async () => {
    const res = await ctx.api.post('/api/ingredients').send({
      name: 'Tomate',
      measurementUnit: 'kg',
      currentStock: 10,
      minimumStock: 2,
      unitCost: 1.2,
    });
    expect(res.status).toBe(201);
    id = res.body.id;

    const detail = await ctx.api.get(`/api/ingredients/${id}`);
    expect(detail.body.inventoryMovements).toHaveLength(1);
    expect(detail.body.inventoryMovements[0]).toMatchObject({ type: 'IN', reason: 'PURCHASE', quantity: 10, newStock: 10 });
  });

  it('POST / valida obligatorios y nombre duplicado', async () => {
    expect((await ctx.api.post('/api/ingredients').send({ name: 'Sin unidad' })).status).toBe(400);
    expect((await ctx.api.post('/api/ingredients').send({ name: 'Tomate', measurementUnit: 'kg' })).status).toBe(400);
  });

  it('PUT /:id con adjustStock (delta con signo) registra el ajuste en el Kardex', async () => {
    const up = await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: 5, adjustReason: 'WASTE' });
    expect(up.status).toBe(200);
    expect(up.body.currentStock).toBe(15);

    const down = await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: -3 });
    expect(down.body.currentStock).toBe(12);

    const moves = await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`);
    expect(moves.status).toBe(200);
    const kinds = moves.body.map((m: any) => `${m.type}:${m.quantity}`);
    expect(kinds).toEqual(expect.arrayContaining(['IN:10', 'IN:5', 'OUT:3']));
  });

  // T2: un motivo fuera del enum MovementReason producía 500.
  it('PUT /:id con adjustReason inválido responde 400 y no cambia el stock ni el Kardex (T2)', async () => {
    const movesBefore = (await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`)).body.length;

    const res = await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: 1, adjustReason: 'Conteo físico' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PURCHASE.*SALE.*WASTE.*MANUAL_ADJUSTMENT/);

    expect((await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: 1, adjustReason: 7 })).status).toBe(400);
    expect((await ctx.api.get(`/api/ingredients/${id}`)).body.currentStock).toBe(12);
    expect((await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`)).body).toHaveLength(movesBefore);
  });

  it('PUT /:id acepta cada motivo del enum MovementReason', async () => {
    for (const reason of ['PURCHASE', 'SALE', 'WASTE', 'MANUAL_ADJUSTMENT']) {
      expect((await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: 1, adjustReason: reason })).status).toBe(200);
      expect((await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: -1, adjustReason: reason })).status).toBe(200);
    }
    expect((await ctx.api.get(`/api/ingredients/${id}`)).body.currentStock).toBe(12);
  });

  it('PUT /:id valida los campos enviados (400) sin modificar nada', async () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ['nombre vacío', { name: '   ' }],
      ['unidad vacía', { measurementUnit: '' }],
      ['stock mínimo negativo', { minimumStock: -1 }],
      ['costo no numérico', { unitCost: 'barato' }],
      ['active no booleano', { active: 'no' }],
      ['adjustStock no numérico', { adjustStock: 'mucho' }],
      ['descripción que no es texto', { description: 5 }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.put(`/api/ingredients/${id}`).send(body);
      expect([label, res.status]).toEqual([label, 400]);
    }
    const now = (await ctx.api.get(`/api/ingredients/${id}`)).body;
    expect(now).toMatchObject({ name: 'Tomate', measurementUnit: 'kg', minimumStock: 2, currentStock: 12 });
  });

  it('PUT /:id con un nombre ya usado responde 400 y el ajuste de stock tampoco se aplica (atómico)', async () => {
    const movesBefore = (await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`)).body.length;

    const res = await ctx.api.put(`/api/ingredients/${id}`).send({ name: 'Pan de Hamburguesa', adjustStock: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya existe/i);

    const now = (await ctx.api.get(`/api/ingredients/${id}`)).body;
    expect(now.name).toBe('Tomate');
    expect(now.currentStock).toBe(12);
    expect((await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`)).body).toHaveLength(movesBefore);
  });

  it('PUT /:id con description null (o vacía) limpia el campo y omitirla no la toca (B10)', async () => {
    await ctx.api.put(`/api/ingredients/${id}`).send({ description: 'Rojo' });
    expect((await ctx.api.put(`/api/ingredients/${id}`).send({ minimumStock: 2 })).body.description).toBe('Rojo');
    expect((await ctx.api.put(`/api/ingredients/${id}`).send({ description: null })).body.description).toBeNull();

    await ctx.api.put(`/api/ingredients/${id}`).send({ description: 'Otra vez' });
    expect((await ctx.api.put(`/api/ingredients/${id}`).send({ description: '' })).body.description).toBeNull();
  });

  it('PUT /:id impide dejar el stock en negativo y no lo modifica', async () => {
    const res = await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: -1000 });
    expect(res.status).toBe(400);
    expect((await ctx.api.get(`/api/ingredients/${id}`)).body.currentStock).toBe(12);
  });

  it('GET /?search= filtra por nombre', async () => {
    const res = await ctx.api.get('/api/ingredients?search=tomat');
    expect(res.body.map((i: any) => i.name)).toEqual(['Tomate']);
  });

  it('GET /inventory/alerts incluye los insumos en o bajo el mínimo', async () => {
    await ctx.api.put(`/api/ingredients/${id}`).send({ adjustStock: -10 }); // 12 -> 2 (= mínimo)
    const alerts = await ctx.api.get('/api/inventory/alerts');
    expect(alerts.status).toBe(200);
    expect(alerts.body.map((i: any) => i.name)).toContain('Tomate');
    expect(alerts.body.every((i: any) => i.currentStock <= i.minimumStock)).toBe(true);
  });

  it('GET /inventory/movements filtra por type y reason', async () => {
    const res = await ctx.api.get(`/api/inventory/movements?ingredientId=${id}&type=OUT`);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((m: any) => m.type === 'OUT')).toBe(true);
  });

  it('DELETE /:id lo borra junto con sus movimientos', async () => {
    expect((await ctx.api.delete(`/api/ingredients/${id}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/ingredients/${id}`)).status).toBe(404);
    const moves = await ctx.api.get(`/api/inventory/movements?ingredientId=${id}`);
    expect(moves.body).toHaveLength(0);
  });
});

describe('/api/ingredients Excel', () => {
  it('GET /template/ingredients descarga un .xlsx con los encabezados de importación', async () => {
    const res = await ctx.api
      .get('/api/ingredients/template/ingredients')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('plantilla_carga_ingredientes.xlsx');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as any);
    const headers = (wb.getWorksheet(1)!.getRow(1).values as any[]).slice(1).map((h) => String(h).replace(/\s*\(\*\)$/, ''));
    expect(headers.slice(0, 3)).toEqual(['Nombre del Insumo', 'Descripción', 'Unidad de Medida']);
  });

  it('GET /export/ingredients genera el reporte con una fila por insumo', async () => {
    const list = (await ctx.api.get('/api/ingredients')).body as any[];
    const res = await ctx.api
      .get('/api/ingredients/export/ingredients')
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as any);
    expect(wb.getWorksheet(1)!.rowCount).toBe(list.length + 1);
  });

  it('POST /import crea, actualiza, omite y reporta errores en un solo lote (resumen final)', async () => {
    const before = (await ctx.api.get('/api/ingredients')).body as any[];
    const panId = idByName(before, 'Pan de Hamburguesa');
    const panStock = before.find((i) => i.id === panId).currentStock as number;

    const file = await buildXlsx([
      ['Cebolla', 'Morada', 'kg', 5, 1, 0.8], // crear
      ['Pan de Hamburguesa', null, 'unidad', panStock + 10, 20, 0.5], // actualizar +10
      [null, 'sin nombre', 'kg', 1, 1, 1], // omitida
      ['Pepino', '', 'kg', -4, 1, 1], // error: stock negativo
    ]);

    const res = await ctx.api.post('/api/ingredients/import/ingredients').attach('file', file, {
      filename: 'insumos.xlsx',
      contentType: XLSX_MIME,
    });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({ created: 1, updated: 1, skipped: 1 });
    expect(res.body.summary.errors).toHaveLength(1);
    expect(res.body.summary.errors[0]).toContain('Pepino');

    const after = (await ctx.api.get('/api/ingredients')).body as any[];
    expect(after.some((i) => i.name === 'Cebolla')).toBe(true);
    expect(after.some((i) => i.name === 'Pepino')).toBe(false);
    expect(after.find((i) => i.id === panId).currentStock).toBe(panStock + 10);

    // El cambio de stock por importación deja rastro en el Kardex
    const moves = (await ctx.api.get(`/api/inventory/movements?ingredientId=${panId}&reason=MANUAL_ADJUSTMENT`)).body as any[];
    expect(moves.some((m) => m.reference === 'Bulk Excel Import' && m.quantity === 10)).toBe(true);
  });

  it('POST /import rechaza: sin archivo, no .xlsx y plantilla con otros encabezados', async () => {
    expect((await ctx.api.post('/api/ingredients/import/ingredients')).status).toBe(400);

    const txt = await ctx.api
      .post('/api/ingredients/import/ingredients')
      .attach('file', Buffer.from('a,b,c'), { filename: 'datos.csv', contentType: 'text/csv' });
    expect(txt.status).toBe(400);

    const other = await buildXlsx([['x', 'y', 'z']], ['Foo', 'Bar', 'Baz', 'A', 'B', 'C']);
    const bad = await ctx.api
      .post('/api/ingredients/import/ingredients')
      .attach('file', other, { filename: 'otra.xlsx', contentType: XLSX_MIME });
    expect(bad.status).toBe(400);
  });
});

describe('POST /api/ingredients validaciones de alta', () => {
  it('rechaza nombre o unidad vacíos, solo espacios o que no son texto, y números inválidos', async () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ['nombre de solo espacios', { name: '   ', measurementUnit: 'kg' }],
      ['unidad de solo espacios', { name: 'Zanahoria', measurementUnit: '  ' }],
      ['nombre que no es texto', { name: 5, measurementUnit: 'kg' }],
      ['stock negativo', { name: 'Zanahoria', measurementUnit: 'kg', currentStock: -1 }],
      ['stock mínimo no numérico', { name: 'Zanahoria', measurementUnit: 'kg', minimumStock: 'poco' }],
      ['costo negativo', { name: 'Zanahoria', measurementUnit: 'kg', unitCost: -2 }],
      ['descripción que no es texto', { name: 'Zanahoria', measurementUnit: 'kg', description: 9 }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.post('/api/ingredients').send(body);
      expect([label, res.status]).toEqual([label, 400]);
    }
    const list = (await ctx.api.get('/api/ingredients')).body as any[];
    expect(list.some((i) => i.name === 'Zanahoria' || i.name.trim() === '')).toBe(false);
  });

  it('recorta nombre y unidad, acepta números como texto y guarda la descripción vacía como null', async () => {
    const res = await ctx.api
      .post('/api/ingredients')
      .send({ name: '  Zanahoria  ', measurementUnit: ' kg ', currentStock: '4', minimumStock: '1', unitCost: '0.5', description: '  ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Zanahoria', measurementUnit: 'kg', currentStock: 4, minimumStock: 1, unitCost: 0.5, description: null });

    // el duplicado se detecta con el nombre ya recortado
    expect((await ctx.api.post('/api/ingredients').send({ name: 'Zanahoria ', measurementUnit: 'kg' })).status).toBe(400);
  });
});

describe('GET /api/inventory/movements paginación en el servidor (I2)', () => {
  let ingredientId: number;
  let allIds: number[];

  beforeAll(async () => {
    const created = await ctx.api.post('/api/ingredients').send({ name: 'Pimiento', measurementUnit: 'kg', currentStock: 10 });
    ingredientId = created.body.id;
    // 1 movimiento inicial + 6 ajustes = 7 movimientos del insumo
    for (const delta of [5, -2, 3, -1, 4, -3]) {
      await ctx.api.put(`/api/ingredients/${ingredientId}`).send({ adjustStock: delta });
    }
    allIds = ((await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}`)).body as any[]).map((m) => m.id);
  });

  it('sin page ni limit devuelve el arreglo completo (el frontend pagina en cliente)', async () => {
    const res = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(7);
    expect(res.body[0].ingredient.name).toBe('Pimiento');
  });

  it('con page y limit devuelve { total, page, limit, totalPages, movements }', async () => {
    const res = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&page=1&limit=3`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 7, page: 1, limit: 3, totalPages: 3 });
    expect(res.body.movements).toHaveLength(3);
    expect(res.body.movements[0].ingredient.name).toBe('Pimiento');

    const dates = res.body.movements.map((m: any) => new Date(m.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('las páginas no se repiten y juntas suman todos los movimientos', async () => {
    const seen: number[] = [];
    for (const page of [1, 2, 3]) {
      const res = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&page=${page}&limit=3`);
      seen.push(...res.body.movements.map((m: any) => m.id));
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect([...seen].sort((a, b) => a - b)).toEqual([...allIds].sort((a, b) => a - b));
  });

  it('una página fuera de rango devuelve la lista vacía conservando el total', async () => {
    const res = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&page=99&limit=3`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 7, page: 99, limit: 3, totalPages: 3, movements: [] });
  });

  it('con solo ?limit usa la página 1; con solo ?page usa el límite por defecto (50); el límite se recorta a 500', async () => {
    const onlyLimit = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&limit=2`);
    expect(onlyLimit.body).toMatchObject({ page: 1, limit: 2, totalPages: 4 });

    const onlyPage = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&page=1`);
    expect(onlyPage.body).toMatchObject({ page: 1, limit: 50, total: 7, totalPages: 1 });

    const huge = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&page=1&limit=100000`);
    expect(huge.body.limit).toBe(500);
  });

  it('se combina con los filtros type y reason', async () => {
    const out = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&type=OUT&page=1&limit=10`);
    expect(out.body.total).toBe(3); // -2, -1, -3
    expect(out.body.movements.every((m: any) => m.type === 'OUT')).toBe(true);

    const purchases = await ctx.api.get(`/api/inventory/movements?ingredientId=${ingredientId}&reason=PURCHASE&page=1&limit=10`);
    expect(purchases.body.total).toBe(1); // el stock inicial
  });

  it('page o limit inválidos responden 400', async () => {
    for (const query of ['page=0', 'page=abc', 'limit=0', 'limit=-3', 'limit=1.5', 'page=1&limit=']) {
      const res = await ctx.api.get(`/api/inventory/movements?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
  });
});
