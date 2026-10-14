# Plantillas de pruebas del backend

Copia y adapta. Todas siguen `tests/helpers/testApp.ts`: `useTestApp()` inicia sesión como Admin, así que `ctx.api` ya manda el token de Admin; `ctx.anon` va sin token y `ctx.createWorker()` crea un WORKER con su propio cliente. Sustituye `suppliers`/`Supplier` por tu módulo.

## Contenido
- Prueba de integración de un CRUD
- Sesión y roles (401 / 403)
- Prueba transaccional con Kardex (rollback)
- Excel: subir, descargar
- Unitaria de una función pura
- Configuración especial con `createApp` (límites, CORS, entorno)
- Regresión de un bug corregido (y `it.failing` solo para bugs sin arreglar)
- Fallos típicos y su causa

## Prueba de integración de un CRUD

```ts
// tests/integration/suppliers.test.ts
import { useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

describe('/api/suppliers', () => {
  let id: number;

  it('POST / crea y devuelve 201 con los campos que consume el frontend', async () => {
    const res = await ctx.api.post('/api/suppliers').send({ name: 'Acme', phone: '555-0101' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Acme', phone: '555-0101' });
    id = res.body.id;
  });

  it('POST / valida obligatorios (body vacío incluido) y duplicado', async () => {
    expect((await ctx.api.post('/api/suppliers').send({})).status).toBe(400);
    expect((await ctx.api.post('/api/suppliers').send({ name: 'Acme' })).status).toBe(400); // @unique
  });

  it('GET /:id, 404 con id inexistente y 400 con id inválido', async () => {
    expect((await ctx.api.get(`/api/suppliers/${id}`)).body.name).toBe('Acme');
    expect((await ctx.api.get('/api/suppliers/999999')).status).toBe(404);
    expect((await ctx.api.get('/api/suppliers/abc')).body).toEqual({ error: 'ID inválido' });
  });

  it('PUT /:id edita parcialmente', async () => {
    const res = await ctx.api.put(`/api/suppliers/${id}`).send({ phone: '555-0202' });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('555-0202');
  });

  it('DELETE /:id y luego 404', async () => {
    expect((await ctx.api.delete(`/api/suppliers/${id}`)).status).toBe(200);
    expect((await ctx.api.get(`/api/suppliers/${id}`)).status).toBe(404);
  });
});
```

## Sesión y roles (401 / 403)

Además de declarar la ruta en `tests/helpers/roleMatrix.ts` (que `auth-roles.test.ts` ya prueba con un WORKER y un ADMIN), un módulo con reglas propias prueba sus matices:

```ts
// tests/integration/suppliers.test.ts (continuación)
import { TestWorker } from '../helpers/testApp';

describe('/api/suppliers: sesión y roles', () => {
  let worker: TestWorker;
  beforeAll(async () => { worker = await ctx.createWorker(); });

  it('sin token -> 401 con code NO_TOKEN', async () => {
    const res = await ctx.anon.get('/api/suppliers');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('un WORKER lee pero no escribe (403)', async () => {
    expect((await worker.api.get('/api/suppliers')).status).toBe(200);
    const res = await worker.api.post('/api/suppliers').send({ name: 'Intruso' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No tienes permisos para realizar esta acción.' });
  });

  it('el usuario de la operación sale del token, no del body', async () => {
    // p. ej. caja: `userId` de otro usuario en el cuerpo se ignora y queda worker.user.id
  });
});
```

Para tokens especiales (vencido, de otra clave, `alg: none`) firma con `jsonwebtoken` y `testJwtSecret()`; el patrón completo está en `tests/integration/auth-middleware.test.ts`.

## Prueba transaccional con Kardex (rollback)

Verifica el contrato de `backend-transactions-kardex`: documento + detalle + movimientos + stock **juntos o nada**.

```ts
import { idByName, openCaja, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

async function stockOf(name: string) {
  const list = (await ctx.api.get('/api/ingredients')).body as any[];
  return list.find((i) => i.name === name).currentStock as number;
}

it('una compra suma stock y deja un movimiento IN/PURCHASE por línea', async () => {
  const ingId = idByName((await ctx.api.get('/api/ingredients')).body, 'Pan de Hamburguesa');
  const before = await stockOf('Pan de Hamburguesa');

  const res = await ctx.api.post('/api/purchases').send({
    supplierId: 1,
    items: [{ ingredientId: ingId, quantity: 5, unitCost: 0.6 }],
  });
  expect(res.status).toBe(201);
  expect(res.body.number).toMatch(/^PUR-\d{4}$/);
  expect(await stockOf('Pan de Hamburguesa')).toBe(before + 5);

  const moves = (await ctx.api.get(`/api/inventory/movements?ingredientId=${ingId}&reason=PURCHASE`)).body as any[];
  expect(moves[0]).toMatchObject({ type: 'IN', quantity: 5, previousStock: before, newStock: before + 5 });
});

it('si una línea es inválida NO se guarda nada (rollback)', async () => {
  const ingId = idByName((await ctx.api.get('/api/ingredients')).body, 'Pan de Hamburguesa');
  const before = await stockOf('Pan de Hamburguesa');
  const purchasesBefore = (await ctx.api.get('/api/purchases')).body.length;

  const res = await ctx.api.post('/api/purchases').send({
    supplierId: 1,
    items: [
      { ingredientId: ingId, quantity: 5, unitCost: 0.6 },   // válida
      { ingredientId: 999999, quantity: 1, unitCost: 1 },    // inexistente -> falla a mitad
    ],
  });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(await stockOf('Pan de Hamburguesa')).toBe(before);                       // stock intacto
  expect((await ctx.api.get('/api/purchases')).body).toHaveLength(purchasesBefore); // sin documento
});
```

Para flujos que exigen caja: `await openCaja(ctx.api)` antes y `await closeCaja(ctx.api)` al final de la historia (cerrar archiva las comandas activas).

## Excel: subir, descargar

```ts
import ExcelJS from 'exceljs';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function buildXlsx(headers: string[], rows: Array<Array<string | number | null>>) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hoja1');
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Subir (multipart, campo "file")
const res = await ctx.api
  .post('/api/ingredients/import/ingredients')
  .attach('file', await buildXlsx(HEADERS, rows), { filename: 'datos.xlsx', contentType: XLSX });
expect(res.body.summary).toMatchObject({ created: 1, updated: 1, skipped: 1 });

// Descargar (binario): recoger los trozos en un Buffer
const dl = await ctx.api
  .get('/api/ingredients/export/ingredients')
  .buffer(true)
  .parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(dl.body as any);
expect(wb.getWorksheet(1)!.rowCount).toBeGreaterThan(1);
```

Los encabezados de la plantilla llevan sufijo ` (*)` en los obligatorios (el importador los normaliza); al comparar con lo descargado, quítalo.

## Unitaria de una función pura

```ts
// tests/unit/sequence.utils.test.ts  (no necesita useTestApp ni BD: el helper recibe sus dependencias)
import { nextSequentialCode } from '../../src/utils/sequence.utils';

it.each([
  [null, 'ORD-0001'],
  [{ id: 9, code: 'ORD-0009' }, 'ORD-0010'],
])('desde %j -> %s', async (last, expected) => {
  const code = await nextSequentialCode({
    prefix: 'ORD-',
    getLast: async () => last,
    exists: async () => false,
  });
  expect(code).toBe(expected);
});
```

## Configuración especial con `createApp` (límites, CORS, entorno)

No cambies `process.env` ni la app compartida: crea otra con su propia configuración (cada llamada trae un almacén de límites de tasa nuevo y lee el entorno en ese momento).

```ts
import supertest from 'supertest';
import { createApp } from '../../src/app';

// Límite de login bajo, para llegar al 429 sin cientos de peticiones
const api = supertest(createApp({ rateLimit: { loginMax: 3 }, frontendDist: null, requestLogger: false }));

// CORS / CSP / trust proxy según el entorno inyectado
const prod = supertest(createApp({ env: { NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) }, frontendDist: null, requestLogger: false }));
```

Ejemplos reales: `security-rate-limit.test.ts` y `security-cors-csp.test.ts`.

## Regresión de un bug corregido (y `it.failing` solo para bugs sin arreglar)

Escribe la prueba del comportamiento correcto, comprueba que **falla** antes de corregir y déjala como regresión con el identificador en el nombre:

```ts
// B5: borrar una categoría con productos respondía 500 (FK restrict).
it('DELETE de una categoría con productos responde 400 con la cuenta y no la borra (B5)', async () => {
  const cats = (await ctx.api.get('/api/categories')).body;
  const res = await ctx.api.delete(`/api/categories/${idByName(cats, 'Hamburguesas')}`);
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/productos? asociados?/);
});
```

Hoy no queda ningún `it.failing` en el repo. Solo si encuentras un bug que **no** te toca arreglar, escribe esa misma prueba con `it.failing(...)` (Jest avisa "expected to fail, but passed" el día que alguien lo corrija) y regístralo en `known-issues.md`.

## Fallos típicos y su causa

| Síntoma | Causa |
|---|---|
| Las pruebas modifican `prisma/dev.db` | importaste `prisma/client` antes de que `setupFiles` fijara `SQLITE_DB_PATH`; no importes módulos del backend desde `tests/setup/` |
| `no such table` | olvidaste `useTestApp()` (no se llamó a `initializeDatabase`) |
| 401 `NO_TOKEN` en una prueba que "debería" pasar | usaste `supertest(app)` a pelo en vez de `ctx.api` (o `ctx.anon`, que va sin token a propósito) |
| 403 en una prueba con un WORKER | la ruta es solo admin, o el cuerpo trae un campo que el WORKER no puede enviar (`requireAdminOrFields`); revisa `roleMatrix.ts` |
| 401 `INVALID_TOKEN` tras `PATCH .../password` | cambiar la contraseña de un usuario invalida sus tokens (también el de `ctx.api` si cambias la del Admin): vuelve a iniciar sesión con `ctx.loginAs` |
| 429 en un archivo con muchos logins | una app con `createApp({ rateLimit })` de límite bajo se reutiliza entre pruebas; crea una por prueba |
| 500 en un POST de la prueba | enviaste un enum fuera de rango (`adjustReason`, `paymentMethod`...) o un body sin los campos que exige Prisma; mira `res.body.details` (siempre texto) |
| Una prueba pasa sola y falla en el archivo | depende del estado que dejó otra anterior del mismo archivo; hazlo explícito en el `describe` |
| `Jest did not exit` / avisos de handles | falta `prisma.$disconnect()` (lo hace `useTestApp`); revisa que no abras conexiones propias sin cerrarlas |
| Valores como `15.000000000000002` | compara dinero con `toBeCloseTo` o con `Number(x.toFixed(2))` |
