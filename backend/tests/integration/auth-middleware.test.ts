/**
 * S1 - Autenticación con JWT: token, middleware `authenticate`, login, /auth/me, identidad en
 * caja y configuración del secreto.
 *
 * El servidor vuelve a leer el usuario de la BD en cada petición: un token válido NO basta si el
 * usuario se desactivó, cambió de rol o cambió su contraseña después de emitirlo.
 */
import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import app, { createApp } from '../../src/app';
import { resetJwtStateForTests } from '../../src/utils/jwt.utils';
import { ADMIN, loginAs, rawLogin, testJwtSecret, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

const UNAUTHORIZED = 'Sesión no válida o expirada. Inicia sesión de nuevo.';

/** Claims del token de Admin (sirve para firmar tokens "casi válidos" con la clave de pruebas). */
const adminClaims = () => jwt.decode(ctx.adminToken) as { sub: string; role: string; pv: string; iat: number; exp: number };

const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

const withToken = (token: string) => ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

/** Firma un token con parámetros a medida (por defecto: válido para Admin con la clave de pruebas). */
function sign(
  payload: Record<string, unknown> = {},
  { secret = testJwtSecret(), ...options }: jwt.SignOptions & { secret?: string } = {}
) {
  const { pv } = adminClaims();
  return jwt.sign({ role: 'ADMIN', pv, ...payload }, secret, {
    algorithm: 'HS256',
    subject: '1',
    expiresIn: '1h',
    ...options,
  });
}

describe('S1: sin credenciales válidas, 401 con `code`', () => {
  it('sin cabecera Authorization -> 401 NO_TOKEN con WWW-Authenticate y sin detalles internos', async () => {
    const res = await ctx.anon.get('/api/categories');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: UNAUTHORIZED, code: 'NO_TOKEN' });
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it.each([
    ['esquema distinto de Bearer', 'Basic YWRtaW46MTIzNDU2'],
    ['Bearer sin token', 'Bearer '],
    ['solo la palabra Bearer', 'Bearer'],
    ['token con espacios', 'Bearer abc def'],
  ])('Authorization con %s -> 401 NO_TOKEN', async (_label, header) => {
    const res = await ctx.anon.get('/api/categories').set('Authorization', header);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('el esquema Bearer no distingue mayúsculas (bearer <token>)', async () => {
    const res = await ctx.anon.get('/api/auth/me').set('Authorization', `bearer ${ctx.adminToken}`);
    expect(res.status).toBe(200);
  });

  it('token basura -> 401 INVALID_TOKEN', async () => {
    for (const garbage of ['no-es-un-jwt', 'a.b.c', 'null', 'undefined', `${ctx.adminToken}x`]) {
      const res = await withToken(garbage);
      expect([garbage, res.status, res.body.code]).toEqual([garbage, 401, 'INVALID_TOKEN']);
      expect(res.body).toEqual({ error: UNAUTHORIZED, code: 'INVALID_TOKEN' });
    }
  });

  it('token con la firma alterada o el contenido cambiado -> 401 INVALID_TOKEN', async () => {
    const [header, payload, signature] = ctx.adminToken.split('.');
    const forgedPayload = b64url({ ...adminClaims(), sub: '999' });
    expect((await withToken(`${header}.${forgedPayload}.${signature}`)).body.code).toBe('INVALID_TOKEN');
    expect((await withToken(`${header}.${payload}.${signature.slice(0, -2)}AA`)).body.code).toBe('INVALID_TOKEN');
  });

  it('token firmado con OTRA clave -> 401 INVALID_TOKEN', async () => {
    const res = await withToken(sign({}, { secret: 'otra-clave-distinta-de-la-del-servidor-0123456789' }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('token con algoritmo `none` (sin firma) -> 401 INVALID_TOKEN', async () => {
    const { pv } = adminClaims();
    const unsigned = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({
      sub: '1',
      role: 'ADMIN',
      pv,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;
    for (const token of [unsigned, unsigned.slice(0, -1)]) {
      const res = await withToken(token);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    }
  });

  it('solo se acepta HS256: un token HS512 con la clave correcta se rechaza', async () => {
    const res = await withToken(sign({}, { algorithm: 'HS512' }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('token vencido -> 401 TOKEN_EXPIRED', async () => {
    const res = await withToken(sign({}, { expiresIn: -10 }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: UNAUTHORIZED, code: 'TOKEN_EXPIRED' });
  });

  it('un token vencido lo rechaza cualquier ruta, no solo /auth/me', async () => {
    const expired = sign({}, { expiresIn: -1 });
    expect((await ctx.anon.get('/api/users').set('Authorization', `Bearer ${expired}`)).body.code).toBe('TOKEN_EXPIRED');
  });

  it('token sin vencimiento -> 401 INVALID_TOKEN (nunca caducaría)', async () => {
    const { pv } = adminClaims();
    const res = await withToken(jwt.sign({ role: 'ADMIN', pv }, testJwtSecret(), { algorithm: 'HS256', subject: '1' }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('token válido de un usuario que no existe -> 401 INVALID_TOKEN', async () => {
    const res = await withToken(sign({}, { subject: '987654' }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('token sin `sub` numérico o con `pv` ajeno -> 401 INVALID_TOKEN', async () => {
    for (const token of [
      sign({}, { subject: 'abc' }),
      sign({}, { subject: '-1' }),
      sign({ pv: 'huella-que-no-es' }),
      sign({ pv: 123 }),
    ]) {
      const res = await withToken(token);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    }
  });

  it('el rol del token NO se cree: un `role: ADMIN` inventado no da permisos de admin', async () => {
    const worker = await ctx.createWorker();
    const { pv } = jwt.decode(worker.token) as { pv: string };
    const forged = jwt.sign({ role: 'ADMIN', pv }, testJwtSecret(), {
      algorithm: 'HS256',
      subject: String(worker.user.id),
      expiresIn: '1h',
    });
    const res = await ctx.anon.get('/api/users').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(403);
  });

  it('el preflight CORS (OPTIONS) y /health siguen siendo públicos', async () => {
    const preflight = await ctx.anon
      .options('/api/users')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(String(preflight.headers['access-control-allow-headers']).toLowerCase()).toContain('authorization');

    expect((await ctx.anon.get('/health')).status).toBe(200);
  });
});

describe('S1: login y GET /api/auth/me', () => {
  it('el login devuelve { user, token } con la forma de siempre para `user` y sin passwordHash', async () => {
    const res = await rawLogin(ADMIN.username, ADMIN.password);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['token', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['active', 'fullName', 'id', 'joinedAt', 'role', 'username']);
    expect(res.body.user).toMatchObject({ username: 'Admin', role: 'ADMIN', active: true });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|scrypt/i);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('el token es un JWT HS256 con sub, role, pv y exp (12 h por defecto) y sin datos sensibles', async () => {
    const { body } = await rawLogin(ADMIN.username, ADMIN.password);
    const decoded = jwt.decode(body.token, { complete: true }) as jwt.Jwt;
    expect(decoded.header.alg).toBe('HS256');
    const claims = decoded.payload as jwt.JwtPayload;
    expect(claims.sub).toBe(String(body.user.id));
    expect(claims.role).toBe('ADMIN');
    expect(claims.pv).toMatch(/^[0-9a-f]{16}$/);
    expect(claims.exp! - claims.iat!).toBe(12 * 60 * 60);
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'pv', 'role', 'sub']);
  });

  it('JWT_EXPIRES_IN cambia la vigencia de los tokens nuevos (y un valor inválido vuelve a 12 h)', async () => {
    const previous = process.env.JWT_EXPIRES_IN;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      process.env.JWT_EXPIRES_IN = '2h';
      let claims = jwt.decode((await rawLogin(ADMIN.username, ADMIN.password)).body.token) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(2 * 60 * 60);

      process.env.JWT_EXPIRES_IN = '900'; // solo dígitos = segundos
      claims = jwt.decode((await rawLogin(ADMIN.username, ADMIN.password)).body.token) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(900);

      process.env.JWT_EXPIRES_IN = 'mucho tiempo';
      claims = jwt.decode((await rawLogin(ADMIN.username, ADMIN.password)).body.token) as jwt.JwtPayload;
      expect(claims.exp! - claims.iat!).toBe(12 * 60 * 60);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('JWT_EXPIRES_IN'));
    } finally {
      if (previous === undefined) delete process.env.JWT_EXPIRES_IN;
      else process.env.JWT_EXPIRES_IN = previous;
      warn.mockRestore();
      resetJwtStateForTests();
    }
  });

  it('el token del login funciona en las rutas protegidas', async () => {
    const { body } = await rawLogin(ADMIN.username, ADMIN.password);
    const res = await ctx.anon.get('/api/categories').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/auth/me devuelve { user } con la misma forma que el login', async () => {
    const login = await rawLogin(ADMIN.username, ADMIN.password);
    const me = await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(Object.keys(me.body)).toEqual(['user']);
    expect(me.body.user).toEqual(login.body.user);
    expect(me.headers['cache-control']).toBe('no-store');
  });

  it('GET /api/auth/me sin token -> 401 NO_TOKEN', async () => {
    const res = await ctx.anon.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  it('GET /api/auth/me lee los datos frescos de la BD (no los del token)', async () => {
    const worker = await ctx.createWorker({ fullName: 'Nombre Original' });
    expect((await worker.api.get('/api/auth/me')).body.user.fullName).toBe('Nombre Original');

    const renamed = await ctx.api.put(`/api/users/${worker.user.id}`).send({ fullName: 'Nombre Nuevo' });
    expect(renamed.status).toBe(200);
    expect((await worker.api.get('/api/auth/me')).body.user.fullName).toBe('Nombre Nuevo');
  });

  it('el login conserva sus errores: 400 sin datos, 401 credenciales, 403 inactivo (y ninguno trae token)', async () => {
    const missing = await ctx.anon.post('/api/auth/login').send({ username: 'Admin' });
    expect(missing.status).toBe(400);

    const wrong = await rawLogin(ADMIN.username, 'incorrecta');
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'Usuario o contraseña incorrectos.' });

    const unknown = await rawLogin('no-existe', 'secreto1');
    expect(unknown.status).toBe(401);

    const worker = await ctx.createWorker();
    await ctx.api.patch(`/api/users/${worker.user.id}/status`).send({ active: false });
    const inactive = await rawLogin(worker.username, worker.password);
    expect(inactive.status).toBe(403);
    expect(inactive.body.token).toBeUndefined();
    expect(inactive.body.error).toMatch(/inactiva/i);
  });

  it('el login sigue sin distinguir mayúsculas (B9) y devuelve token', async () => {
    for (const username of ['admin', 'ADMIN', ' Admin ']) {
      const res = await rawLogin(username, ADMIN.password);
      expect([username, res.status]).toEqual([username, 200]);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.username).toBe('Admin');
    }
  });
});

describe('S1: el usuario se vuelve a leer de la BD en cada petición', () => {
  it('desactivar al usuario invalida su token al instante (401 USER_INACTIVE) y reactivarlo lo devuelve a la vida', async () => {
    const worker = await ctx.createWorker();
    expect((await worker.api.get('/api/categories')).status).toBe(200);

    expect((await ctx.api.patch(`/api/users/${worker.user.id}/status`).send({ active: false })).status).toBe(200);
    const blocked = await worker.api.get('/api/categories');
    expect(blocked.status).toBe(401);
    expect(blocked.body).toEqual({ error: UNAUTHORIZED, code: 'USER_INACTIVE' });
    expect((await worker.api.get('/api/auth/me')).status).toBe(401);

    expect((await ctx.api.patch(`/api/users/${worker.user.id}/status`).send({ active: true })).status).toBe(200);
    expect((await worker.api.get('/api/categories')).status).toBe(200);
  });

  it('un cambio de rol se aplica de inmediato con el mismo token, hacia arriba y hacia abajo', async () => {
    const worker = await ctx.createWorker();
    expect((await worker.api.get('/api/users')).status).toBe(403);

    await ctx.api.put(`/api/users/${worker.user.id}`).send({ role: 'ADMIN' });
    expect((await worker.api.get('/api/users')).status).toBe(200);
    expect((await worker.api.get('/api/auth/me')).body.user.role).toBe('ADMIN');

    await ctx.api.put(`/api/users/${worker.user.id}`).send({ role: 'WORKER' });
    expect((await worker.api.get('/api/users')).status).toBe(403);
    expect((await worker.api.get('/api/auth/me')).body.user.role).toBe('WORKER');
  });

  it('cambiar la contraseña invalida los tokens anteriores del usuario (401 INVALID_TOKEN)', async () => {
    const worker = await ctx.createWorker({ password: 'clave-vieja-1' });
    const secondSession = await loginAs(worker.username, 'clave-vieja-1');
    expect((await worker.api.get('/api/categories')).status).toBe(200);
    expect((await secondSession.api.get('/api/categories')).status).toBe(200);

    const changed = await ctx.api.patch(`/api/users/${worker.user.id}/password`).send({ password: 'clave-nueva-2' });
    expect(changed.status).toBe(200);

    for (const stale of [worker, secondSession]) {
      const res = await stale.api.get('/api/categories');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    }

    expect((await rawLogin(worker.username, 'clave-vieja-1')).status).toBe(401);
    const fresh = await loginAs(worker.username, 'clave-nueva-2');
    expect((await fresh.api.get('/api/categories')).status).toBe(200);
  });

  it('cambiar la contraseña de OTRO usuario no afecta a los tokens de los demás', async () => {
    const first = await ctx.createWorker();
    const second = await ctx.createWorker();
    await ctx.api.patch(`/api/users/${first.user.id}/password`).send({ password: 'otra-clave-3' });
    expect((await second.api.get('/api/categories')).status).toBe(200);
    expect((await ctx.api.get('/api/categories')).status).toBe(200);
  });
});

describe('S1: la identidad de caja sale del token, no del cuerpo', () => {
  it('abrir y cerrar con `userId` de otro usuario en el cuerpo lo ignora: queda el usuario autenticado', async () => {
    const worker = await ctx.createWorker();
    const adminId = (await ctx.api.get('/api/auth/me')).body.user.id as number;

    // El trabajador intenta abrir la caja "a nombre del admin"
    const open = await worker.api.post('/api/caja/open').send({ denominations: { '1': 10 }, userId: adminId });
    expect(open.status).toBe(201);
    expect(open.body.openedByUserId).toBe(worker.user.id);
    expect(open.body.openedByUser).toMatchObject({ id: worker.user.id, username: worker.username });

    // El admin cierra enviando el id del trabajador
    const close = await ctx.api.post('/api/caja/close').send({ denominations: { '1': 10 }, userId: worker.user.id });
    expect(close.status).toBe(200);
    expect(close.body.closedByUserId).toBe(adminId);
    expect(close.body.closedByUser).toMatchObject({ id: adminId, username: 'Admin' });
  });

  it('sin userId en el cuerpo también se registra al usuario autenticado', async () => {
    const worker = await ctx.createWorker();
    const open = await worker.api.post('/api/caja/open').send({ denominations: { '5': 2 } });
    expect(open.status).toBe(201);
    expect(open.body.openedByUserId).toBe(worker.user.id);
    const close = await worker.api.post('/api/caja/close').send({ denominations: { '5': 2 } });
    expect(close.status).toBe(200);
    expect(close.body.closedByUserId).toBe(worker.user.id);
  });

  it('abrir y cerrar caja sin token -> 401', async () => {
    expect((await ctx.anon.post('/api/caja/open').send({ denominations: { '1': 1 } })).status).toBe(401);
    expect((await ctx.anon.post('/api/caja/close').send({ denominations: { '1': 1 } })).status).toBe(401);
    expect((await ctx.api.get('/api/caja/status')).body.isOpen).toBe(false);
  });
});

describe('S1: configuración de JWT_SECRET', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    resetJwtStateForTests();
    jest.restoreAllMocks();
  });

  it('createApp en producción sin JWT_SECRET arranca y avisa claramente al arrancar', () => {
    resetJwtStateForTests();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const productionApp = createApp({ env: { NODE_ENV: 'production', JWT_SECRET: '' }, requestLogger: false, frontendDist: null });
    expect(typeof productionApp).toBe('function');

    const jwtWarnings = warn.mock.calls.map(([message]) => String(message)).filter((message) => message.includes('JWT_SECRET'));
    expect(jwtWarnings).toHaveLength(1);
    expect(jwtWarnings[0]).toMatch(/aleatorio/);
    expect(jwtWarnings[0]).toMatch(/sesiones se invalidar/i);
  });

  it('en producción sin JWT_SECRET el login y las rutas protegidas funcionan con un secreto aleatorio del proceso', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '';
    resetJwtStateForTests();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const login = await rawLogin(ADMIN.username, ADMIN.password);
    expect(login.status).toBe(200);
    expect((await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(200);
    expect((await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(200);

    // El token firmado con la clave de pruebas (otra) ya no vale: el secreto es el aleatorio
    expect((await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${ctx.adminToken}`)).body.code).toBe('INVALID_TOKEN');

    // El aviso sale una sola vez, aunque haya muchas peticiones
    expect(warn.mock.calls.filter(([message]) => String(message).includes('JWT_SECRET'))).toHaveLength(1);
    const [jwtWarning] = warn.mock.calls.map(([message]) => String(message)).filter((message) => message.includes('JWT_SECRET'));
    expect(jwtWarning).toMatch(/TODAS las sesiones se invalidar/);
  });

  it('un secreto corto (< 32 caracteres) avisa pero se usa', async () => {
    process.env.JWT_SECRET = 'corto-pero-valido';
    resetJwtStateForTests();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const login = await rawLogin(ADMIN.username, ADMIN.password);
    expect(login.status).toBe(200);
    expect((await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(200);
    // y el token está firmado con ese secreto, no con otro
    expect(() => jwt.verify(login.body.token, 'corto-pero-valido', { algorithms: ['HS256'] })).not.toThrow();

    const shortWarnings = warn.mock.calls.filter(([message]) => /JWT_SECRET tiene solo \d+ caracteres/.test(String(message)));
    expect(shortWarnings).toHaveLength(1);
  });

  it('con un secreto de 32+ caracteres no hay avisos', async () => {
    resetJwtStateForTests();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await rawLogin(ADMIN.username, ADMIN.password)).status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
  });

  it('cambiar el secreto del servidor cierra todas las sesiones abiertas', async () => {
    const before = await rawLogin(ADMIN.username, ADMIN.password);
    process.env.JWT_SECRET = 'un-secreto-nuevo-de-mas-de-treinta-y-dos-caracteres';
    const res = await ctx.anon.get('/api/auth/me').set('Authorization', `Bearer ${before.body.token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

describe('S1: la app exportada por defecto exige token', () => {
  it('app (la de producción) responde 401 a /api sin token y 200 a /health', async () => {
    expect((await supertest(app).get('/api/users')).status).toBe(401);
    expect((await supertest(app).get('/health')).status).toBe(200);
  });
});
