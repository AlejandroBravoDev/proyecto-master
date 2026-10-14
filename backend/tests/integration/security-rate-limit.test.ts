/**
 * S5 / T1 (SECURITY_TEST_REPORT.md): límites de tasa.
 *
 * Cada prueba crea su propia app con `createApp({ rateLimit })` (límites bajos inyectados y
 * almacén en memoria nuevo), así no depende del orden ni de process.env. Si alguien quita el
 * limitador de app.ts, las aserciones de 429 de este archivo fallan.
 */
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { RATE_LIMIT_DEFAULTS, readRateLimitConfig } from '../../src/middleware/rateLimit';
import { useTestApp, ADMIN } from '../helpers/testApp';

// Inicializa la BD temporal (Admin/123456) y la limpia al terminar; `ctx.adminToken` da acceso a /api.
const ctx = useTestApp();
const auth = () => ({ Authorization: `Bearer ${ctx.adminToken}` });

const WINDOW_MS = 15 * 60 * 1000;

const login = (api: ReturnType<typeof supertest>, password: string, extra: Record<string, string> = {}) => {
  let req = api.post('/api/auth/login');
  for (const [header, value] of Object.entries(extra)) req = req.set(header, value);
  return req.send({ username: ADMIN.username, password });
};

describe('rate limit de login (por IP, solo intentos fallidos)', () => {
  it('el intento N+1 devuelve 429 con Retry-After y RateLimit-*, y el cupo no se agota antes', async () => {
    const api = supertest(createApp({ rateLimit: { loginMax: 3, loginWindowMs: WINDOW_MS } }));

    for (let i = 1; i <= 3; i++) {
      const res = await login(api, `incorrecta-${i}`);
      expect(res.status).toBe(401);
      expect(res.headers['ratelimit-limit']).toBe('3');
      expect(res.headers['ratelimit-remaining']).toBe(String(3 - i));
    }

    const blocked = await login(api, 'incorrecta-4');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/^Demasiados intentos/);
    expect(blocked.body.error).toMatch(/minutos/); // espera legible en español
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(WINDOW_MS / 1000);
    expect(blocked.headers['ratelimit-limit']).toBe('3');
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
    expect(blocked.headers['ratelimit-reset']).toBeDefined();
    // El 429 no filtra internals
    expect(Object.keys(blocked.body)).toEqual(['error']);
  });

  it('un login correcto no consume cupo, pero con el cupo agotado ni la contraseña buena entra', async () => {
    const api = supertest(createApp({ rateLimit: { loginMax: 3, loginWindowMs: WINDOW_MS } }));

    // Muchos más logins correctos que el máximo: ninguno cuenta
    for (let i = 0; i < 6; i++) {
      const ok = await login(api, ADMIN.password);
      expect(ok.status).toBe(200);
    }

    // Los fallos intercalados con aciertos tampoco se "reinician": se acumulan hasta 3
    expect((await login(api, 'mala-1')).status).toBe(401);
    expect((await login(api, ADMIN.password)).status).toBe(200);
    expect((await login(api, 'mala-2')).status).toBe(401);
    expect((await login(api, 'mala-3')).status).toBe(401);

    // Cupo agotado: es 429 incluso con la contraseña correcta (frena la fuerza bruta)
    const afterBlock = await login(api, ADMIN.password);
    expect(afterBlock.status).toBe(429);
    expect(afterBlock.headers['retry-after']).toBeDefined();
  });

  it('un cuerpo sin credenciales (400) también cuenta como intento fallido', async () => {
    const api = supertest(createApp({ rateLimit: { loginMax: 2, loginWindowMs: WINDOW_MS } }));
    expect((await api.post('/api/auth/login')).status).toBe(400);
    expect((await api.post('/api/auth/login').send({})).status).toBe(400);
    expect((await api.post('/api/auth/login').send({})).status).toBe(429);
  });

  it('el límite del login no afecta a otras rutas de la API', async () => {
    const api = supertest(createApp({ rateLimit: { loginMax: 1, loginWindowMs: WINDOW_MS } }));
    expect((await login(api, 'mala')).status).toBe(401);
    expect((await login(api, 'mala')).status).toBe(429);
    expect((await api.get('/api/categories').set(auth())).status).toBe(200);
    expect((await api.get('/health')).status).toBe(200);
  });

  it('con RATE_LIMIT_DISABLED no se bloquea nada', async () => {
    const api = supertest(createApp({ rateLimit: { disabled: true, loginMax: 1 } }));
    for (let i = 0; i < 4; i++) {
      expect((await login(api, `mala-${i}`)).status).toBe(401);
    }
  });
});

describe('rate limit global de /api', () => {
  it('bloquea /api al pasar el máximo (429 + Retry-After) pero /health queda fuera', async () => {
    const api = supertest(createApp({ rateLimit: { apiMax: 5, apiWindowMs: 60_000, loginMax: 1000 } }));

    for (let i = 1; i <= 5; i++) {
      const res = await api.get('/api/categories').set(auth());
      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('5');
    }

    const blocked = await api.get('/api/categories').set(auth());
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/^Demasiadas peticiones/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // El 404 de la API también está dentro del límite global (cualquier ruta de /api)
    expect((await api.get('/api/no-existe')).status).toBe(429);

    // /health no cuenta ni se bloquea, aunque /api ya esté agotado
    for (let i = 0; i < 15; i++) {
      const health = await api.get('/health');
      expect(health.status).toBe(200);
      expect(health.headers['ratelimit-limit']).toBeUndefined();
    }
  });

  it('un cliente bloqueado recibe el 429 con cabeceras CORS (el navegador puede leerlo)', async () => {
    const api = supertest(createApp({ rateLimit: { apiMax: 1, loginMax: 1000 } }));
    await api.get('/api/categories').set('Origin', 'http://localhost:5173');
    const blocked = await api.get('/api/categories').set('Origin', 'http://localhost:5173');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('configuración por entorno y valores por defecto', () => {
  it('en producción/desarrollo los valores por defecto son estrictos en login y holgados en /api', () => {
    const cfg = readRateLimitConfig({ NODE_ENV: 'production' });
    expect(cfg).toEqual({ disabled: false, ...RATE_LIMIT_DEFAULTS });
    expect(cfg.loginMax).toBe(10);
    expect(cfg.loginWindowMs).toBe(15 * 60 * 1000);
    expect(cfg.apiMax).toBe(600);
    expect(cfg.apiWindowMs).toBe(60 * 1000);
    expect(readRateLimitConfig({})).toEqual(cfg);
  });

  it('las variables RATE_LIMIT_* sobrescriben los valores y RATE_LIMIT_DISABLED=true apaga los límites', () => {
    expect(
      readRateLimitConfig({
        NODE_ENV: 'production',
        RATE_LIMIT_LOGIN_MAX: '5',
        RATE_LIMIT_LOGIN_WINDOW_MS: '60000',
        RATE_LIMIT_API_MAX: '1200',
        RATE_LIMIT_API_WINDOW_MS: '30000',
        RATE_LIMIT_DISABLED: 'true',
      })
    ).toEqual({ disabled: true, loginMax: 5, loginWindowMs: 60000, apiMax: 1200, apiWindowMs: 30000 });
  });

  it('valores inválidos o vacíos vuelven al valor por defecto (con aviso)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const cfg = readRateLimitConfig({
        NODE_ENV: 'production',
        RATE_LIMIT_LOGIN_MAX: 'muchos',
        RATE_LIMIT_API_MAX: '-3',
        RATE_LIMIT_API_WINDOW_MS: '',
      });
      expect(cfg.loginMax).toBe(RATE_LIMIT_DEFAULTS.loginMax);
      expect(cfg.apiMax).toBe(RATE_LIMIT_DEFAULTS.apiMax);
      expect(cfg.apiWindowMs).toBe(RATE_LIMIT_DEFAULTS.apiWindowMs);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it('con NODE_ENV=test los límites por defecto son tan altos que 40 logins fallidos no bloquean', async () => {
    const cfg = readRateLimitConfig({ NODE_ENV: 'test' });
    expect(cfg.loginMax).toBeGreaterThanOrEqual(10000);
    expect(cfg.apiMax).toBeGreaterThanOrEqual(100000);

    // App por defecto de pruebas (sin inyectar límites): nunca devuelve 429
    const api = supertest(createApp());
    for (let i = 0; i < 40; i++) {
      const res = await api.post('/api/auth/login').send({ username: 'nadie', password: `x-${i}` });
      expect(res.status).toBe(401);
    }
  });
});

describe('trust proxy: la IP real viene en X-Forwarded-For', () => {
  it('con TRUST_PROXY=1 cada IP de X-Forwarded-For tiene su propio cupo', async () => {
    const api = supertest(
      createApp({ env: { NODE_ENV: 'test', TRUST_PROXY: '1' }, rateLimit: { loginMax: 2, loginWindowMs: WINDOW_MS } })
    );

    const as = (ip: string) => ({ 'X-Forwarded-For': ip });
    expect((await login(api, 'mala', as('203.0.113.10'))).status).toBe(401);
    expect((await login(api, 'mala', as('203.0.113.10'))).status).toBe(401);
    expect((await login(api, 'mala', as('203.0.113.10'))).status).toBe(429);

    // Otro cliente detrás del mismo proxy no queda bloqueado
    expect((await login(api, 'mala', as('203.0.113.99'))).status).toBe(401);
  });

  it('sin trust proxy (dev/test) X-Forwarded-For se ignora: cambiarlo no evita el bloqueo', async () => {
    // express-rate-limit avisa por consola de que llega la cabecera sin trust proxy: se silencia aquí
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const api = supertest(createApp({ rateLimit: { loginMax: 2, loginWindowMs: WINDOW_MS } }));
      expect((await login(api, 'mala', { 'X-Forwarded-For': '198.51.100.1' })).status).toBe(401);
      expect((await login(api, 'mala', { 'X-Forwarded-For': '198.51.100.2' })).status).toBe(401);
      expect((await login(api, 'mala', { 'X-Forwarded-For': '198.51.100.3' })).status).toBe(429);
    } finally {
      error.mockRestore();
    }
  });
});
