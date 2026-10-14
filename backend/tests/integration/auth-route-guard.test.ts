/**
 * S1 - Prueba-guardia de inventario de rutas.
 *
 * Recorre TODAS las rutas realmente registradas en la app de Express y exige que:
 *  1. toda ruta bajo /api, salvo POST /api/auth/login, responda 401 NO_TOKEN sin token;
 *  2. no haya rutas públicas fuera de /api salvo GET /health;
 *  3. cada ruta esté declarada en la matriz de roles (tests/helpers/roleMatrix.ts), y viceversa.
 *
 * Si alguien añade una ruta sin autenticación (por ejemplo en `auth.routes.ts` sin `authenticate`,
 * o con `app.get('/api/...')` antes del montaje de la API), esta prueba falla.
 *
 * Express 5 no conserva el path con el que se registra cada capa (solo una función que compara), así
 * que el `jest.mock` de abajo envuelve `Layer` para anotar el path original en cada capa y poder
 * reconstruir la ruta completa de las rutas anidadas (`/api` + `/users` + `/:id`).
 */
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { ROLE_MATRIX, concretePath } from '../helpers/roleMatrix';
import { useTestApp } from '../helpers/testApp';

jest.mock('router/lib/layer', () => {
  const ActualLayer = jest.requireActual('router/lib/layer');
  function RecordingLayer(this: unknown, path: unknown, options: unknown, fn: unknown) {
    const layer = new ActualLayer(path, options, fn);
    layer.registeredPath = path;
    return layer;
  }
  RecordingLayer.prototype = ActualLayer.prototype;
  return RecordingLayer;
});

useTestApp();

interface RouteEntry {
  method: string;
  path: string;
}

/** Une segmentos de ruta sin barras duplicadas ni barra final. */
function joinPaths(prefix: string, path: unknown): string {
  if (typeof path !== 'string') {
    throw new Error(`No se pudo reconstruir la ruta: path de registro desconocido (${String(path)})`);
  }
  const joined = `${prefix}/${path}`.replace(/\/+/g, '/');
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined;
}

/** Recorre recursivamente la pila de un router y devuelve cada (método, ruta completa). */
function collectRoutes(stack: any[], prefix: string, out: RouteEntry[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const fullPath = joinPaths(prefix, layer.registeredPath);
      for (const method of Object.keys(layer.route.methods)) {
        out.push({ method: method.toUpperCase(), path: fullPath });
      }
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      collectRoutes(layer.handle.stack, joinPaths(prefix, layer.registeredPath), out);
    }
  }
}

const app = createApp({ frontendDist: null, requestLogger: false });
const rawRoutes: RouteEntry[] = [];
collectRoutes((app as any).router.stack, '', rawRoutes);

/** Rutas únicas (el limitador del login registra además un POST /api/auth/login en app.ts). */
const routes = [...new Map(rawRoutes.map((r) => [`${r.method} ${r.path}`, r])).values()];
const apiRoutes = routes.filter((r) => r.path === '/api' || r.path.startsWith('/api/'));
const key = (r: RouteEntry) => `${r.method} ${r.path}`;

const anon = supertest(app);

describe('S1: inventario de rutas de la API', () => {
  it('el recorrido encuentra las rutas (la prueba no es ciega)', () => {
    const keys = apiRoutes.map(key);
    expect(apiRoutes.length).toBeGreaterThanOrEqual(40);
    expect(keys).toEqual(
      expect.arrayContaining([
        'POST /api/auth/login',
        'GET /api/auth/me',
        'GET /api/users',
        'PATCH /api/users/:id/password',
        'POST /api/orders',
        'POST /api/caja/open',
        'GET /api/ingredients/template/ingredients',
      ])
    );
  });

  it('fuera de /api solo hay una ruta pública: GET /health', () => {
    expect(routes.filter((r) => !apiRoutes.includes(r)).map(key)).toEqual(['GET /health']);
  });

  it.each(apiRoutes.filter((r) => key(r) !== 'POST /api/auth/login').map((r) => [key(r), r] as const))(
    '%s sin token responde 401 NO_TOKEN',
    async (_label, route) => {
      const url = concretePath(route.path);
      const request = (anon as any)[route.method.toLowerCase()](url);
      const res = await (['POST', 'PUT', 'PATCH'].includes(route.method) ? request.send({}) : request);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('NO_TOKEN');
      expect(res.body.error).toBe('Sesión no válida o expirada. Inicia sesión de nuevo.');
    }
  );

  it('una ruta de /api que no existe también responde 401 sin token (no revela qué rutas hay)', async () => {
    expect((await anon.get('/api/no-existe')).status).toBe(401);
    expect((await anon.post('/api/otra/cosa').send({})).status).toBe(401);
  });

  it('POST /api/auth/login es pública: sin token llega al controlador (400 sin credenciales)', async () => {
    const res = await anon.post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('GET /health sigue siendo público', async () => {
    expect((await anon.get('/health')).status).toBe(200);
  });
});

describe('S1: la matriz de roles declarada cubre exactamente las rutas registradas', () => {
  const registered = new Set(apiRoutes.map(key));
  const declared = new Set(ROLE_MATRIX.map((rule) => rule.route));

  it('toda ruta registrada tiene un rol declarado en tests/helpers/roleMatrix.ts', () => {
    const undeclared = [...registered].filter((route) => !declared.has(route));
    expect(undeclared).toEqual([]);
  });

  it('no hay entradas de la matriz para rutas que ya no existen', () => {
    const stale = [...declared].filter((route) => !registered.has(route));
    expect(stale).toEqual([]);
  });

  it('solo POST /api/auth/login está marcada como pública', () => {
    expect(ROLE_MATRIX.filter((rule) => rule.public).map((rule) => rule.route)).toEqual(['POST /api/auth/login']);
  });
});
