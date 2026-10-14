import { ADMIN, useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

describe('POST /api/auth/login', () => {
  it('inicia sesión con el Admin sembrado y no expone el hash', async () => {
    const res = await ctx.api.post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'Admin', role: 'ADMIN', active: true });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/);
  });

  it('400 si faltan usuario o contraseña (también con body vacío)', async () => {
    expect((await ctx.api.post('/api/auth/login').send({ username: 'Admin' })).status).toBe(400);
    expect((await ctx.api.post('/api/auth/login').send({ password: '123456' })).status).toBe(400);
  });

  it('401 con contraseña incorrecta o usuario inexistente', async () => {
    const bad = await ctx.api.post('/api/auth/login').send({ username: 'Admin', password: 'mala-clave' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('Usuario o contraseña incorrectos.');

    const ghost = await ctx.api.post('/api/auth/login').send({ username: 'fantasma', password: '123456' });
    expect(ghost.status).toBe(401);
  });
});

describe('/api/users', () => {
  let workerId: number;

  it('GET / lista usuarios sin passwordHash', async () => {
    const res = await ctx.api.get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u: any) => u.username === 'Admin')).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('POST / crea un trabajador (rol WORKER por defecto) que puede iniciar sesión', async () => {
    const res = await ctx.api
      .post('/api/users')
      .send({ fullName: 'María Pérez', username: 'maria', password: 'clave123' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fullName: 'María Pérez', username: 'maria', role: 'WORKER', active: true });
    workerId = res.body.id;

    const login = await ctx.api.post('/api/auth/login').send({ username: 'maria', password: 'clave123' });
    expect(login.status).toBe(200);
  });

  it('POST / rechaza contraseña corta, datos faltantes y usuario duplicado', async () => {
    const short = await ctx.api.post('/api/users').send({ fullName: 'X', username: 'corto', password: '123' });
    expect(short.status).toBe(400);

    const missing = await ctx.api.post('/api/users').send({ fullName: 'X' });
    expect(missing.status).toBe(400);

    const dup = await ctx.api.post('/api/users').send({ fullName: 'Otra', username: 'maria', password: 'clave123' });
    expect(dup.status).toBe(400);
  });

  it('GET /:id devuelve el usuario o 404', async () => {
    expect((await ctx.api.get(`/api/users/${workerId}`)).body.username).toBe('maria');
    expect((await ctx.api.get('/api/users/999999')).status).toBe(404);
  });

  it('PATCH /:id/password cambia la clave: la vieja deja de servir', async () => {
    const res = await ctx.api.patch(`/api/users/${workerId}/password`).send({ password: 'nueva-clave' });
    expect(res.status).toBe(200);

    const old = await ctx.api.post('/api/auth/login').send({ username: 'maria', password: 'clave123' });
    const fresh = await ctx.api.post('/api/auth/login').send({ username: 'maria', password: 'nueva-clave' });
    expect(old.status).toBe(401);
    expect(fresh.status).toBe(200);
  });

  it('PATCH /:id/status desactiva al trabajador y el login devuelve 403', async () => {
    const off = await ctx.api.patch(`/api/users/${workerId}/status`).send({ active: false });
    expect(off.status).toBe(200);
    expect(off.body.active).toBe(false);

    const login = await ctx.api.post('/api/auth/login').send({ username: 'maria', password: 'nueva-clave' });
    expect(login.status).toBe(403);
  });

  it('PUT /:id edita nombre y rol; rechaza usuario duplicado y 404', async () => {
    const edit = await ctx.api.put(`/api/users/${workerId}`).send({ fullName: '  María P.  ', role: 'ADMIN' });
    expect(edit.status).toBe(200);
    expect(edit.body).toMatchObject({ fullName: 'María P.', role: 'ADMIN' });

    const dup = await ctx.api.put(`/api/users/${workerId}`).send({ username: 'Admin' });
    expect(dup.status).toBe(400);

    expect((await ctx.api.put('/api/users/999999').send({ fullName: 'X' })).status).toBe(404);

    // devolverla a WORKER para no alterar las demás pruebas
    await ctx.api.put(`/api/users/${workerId}`).send({ role: 'WORKER' });
  });

  it('PATCH /:id/status exige un booleano', async () => {
    expect((await ctx.api.patch(`/api/users/${workerId}/status`).send({ active: 'si' })).status).toBe(400);
    expect((await ctx.api.patch(`/api/users/${workerId}/status`).send({})).status).toBe(400);
  });

  it('PATCH /:id/password rechaza claves cortas', async () => {
    expect((await ctx.api.patch(`/api/users/${workerId}/password`).send({ password: '123' })).status).toBe(400);
    expect((await ctx.api.patch(`/api/users/${workerId}/password`).send({})).status).toBe(400);
  });

  it('no permite degradar al último administrador', async () => {
    const users = (await ctx.api.get('/api/users')).body as any[];
    const adminId = users.find((u) => u.username === 'Admin').id;
    const res = await ctx.api.put(`/api/users/${adminId}`).send({ role: 'WORKER' });
    expect(res.status).toBe(400);
  });

  it('no permite desactivar al último administrador', async () => {
    const users = (await ctx.api.get('/api/users')).body as any[];
    const adminId = users.find((u) => u.username === 'Admin').id;
    const res = await ctx.api.patch(`/api/users/${adminId}/status`).send({ active: false });
    expect(res.status).toBe(400);

    const still = await ctx.api.post('/api/auth/login').send(ADMIN);
    expect(still.status).toBe(200);
  });
});

describe('B9: el nombre de usuario es único y el login no distingue mayúsculas', () => {
  const create = (username: string, fullName = 'Persona de prueba') =>
    ctx.api.post('/api/users').send({ fullName, username, password: 'clave123' });

  it('POST / rechaza un nombre que solo difiere en mayúsculas o espacios de uno existente', async () => {
    for (const username of ['ADMIN', 'admin', 'aDMIN', ' Admin ', 'MARIA', 'Maria']) {
      const res = await create(username);
      expect([username, res.status]).toEqual([username, 400]);
      expect(res.body.error).toMatch(/ya está registrado/i);
    }
  });

  it('guarda el nombre con la capitalización escrita y deja entrar con cualquier variante', async () => {
    const res = await create('  LuisGomez  ', 'Luis Gómez');
    expect(res.status).toBe(201);
    expect(res.body.username).toBe('LuisGomez');

    for (const username of ['LuisGomez', 'luisgomez', 'LUISGOMEZ', 'lUiSgOmEz']) {
      const login = await ctx.api.post('/api/auth/login').send({ username, password: 'clave123' });
      expect([username, login.status]).toEqual([username, 200]);
      expect(login.body.user.username).toBe('LuisGomez');
    }
    // la contraseña sigue distinguiendo mayúsculas
    expect((await ctx.api.post('/api/auth/login').send({ username: 'luisgomez', password: 'CLAVE123' })).status).toBe(401);
  });

  it('también compara letras con tilde y eñe (no solo ASCII)', async () => {
    expect((await create('Ñandú')).status).toBe(201);
    for (const username of ['ñandú', 'ÑANDÚ', 'ñANDÚ']) {
      expect([username, (await create(username)).status]).toEqual([username, 400]);
    }
    const login = await ctx.api.post('/api/auth/login').send({ username: 'ÑANDÚ', password: 'clave123' });
    expect(login.status).toBe(200);
    expect(login.body.user.username).toBe('Ñandú');
  });

  it('PUT /:id rechaza renombrar a una variante de otro usuario, pero permite cambiar solo la capitalización del propio', async () => {
    const users = (await ctx.api.get('/api/users')).body as any[];
    const luisId = users.find((u) => u.username === 'LuisGomez').id;

    for (const username of ['ADMIN', 'admin', 'maria', 'MARIA', 'ñandú']) {
      const res = await ctx.api.put(`/api/users/${luisId}`).send({ username });
      expect([username, res.status]).toEqual([username, 400]);
      expect(res.body.error).toMatch(/ya está registrado/i);
    }
    expect((await ctx.api.get(`/api/users/${luisId}`)).body.username).toBe('LuisGomez');

    const recased = await ctx.api.put(`/api/users/${luisId}`).send({ username: 'LUISGOMEZ' });
    expect(recased.status).toBe(200);
    expect(recased.body.username).toBe('LUISGOMEZ');
    expect((await ctx.api.post('/api/auth/login').send({ username: 'luisgomez', password: 'clave123' })).body.user.username).toBe('LUISGOMEZ');

    const renamed = await ctx.api.put(`/api/users/${luisId}`).send({ username: 'Luis.G' });
    expect(renamed.body.username).toBe('Luis.G');
    // el nombre viejo queda libre
    expect((await create('luisgomez')).status).toBe(201);
  });

  it('PUT /:id no deja vacío el usuario ni el nombre completo, ni acepta fechas o estados inválidos', async () => {
    const users = (await ctx.api.get('/api/users')).body as any[];
    const luisId = users.find((u) => u.username === 'Luis.G').id;

    const bad: Array<[string, Record<string, unknown>]> = [
      ['usuario de solo espacios', { username: '   ' }],
      ['usuario vacío', { username: '' }],
      ['nombre completo vacío', { fullName: '  ' }],
      ['usuario que no es texto', { username: 5 }],
      ['fecha de ingreso inválida', { joinedAt: 'no-es-fecha' }],
      ['active que no es booleano', { active: 'si' }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.put(`/api/users/${luisId}`).send(body);
      expect([label, res.status]).toEqual([label, 400]);
      expect(typeof res.body.error).toBe('string');
    }
    expect((await ctx.api.get(`/api/users/${luisId}`)).body).toMatchObject({ username: 'Luis.G', fullName: 'Luis Gómez', active: true });
    const badDate = await ctx.api
      .post('/api/users')
      .send({ fullName: 'Otra', username: 'FechaMala', password: 'clave123', joinedAt: 'no-es-fecha' });
    expect(badDate.status).toBe(400);
  });
});

describe('I1: GET /api/users paginado en el servidor', () => {
  beforeAll(async () => {
    for (let i = 1; i <= 5; i++) {
      await ctx.api.post('/api/users').send({ fullName: `Paginado ${i}`, username: `paginado${i}`, password: 'clave123' });
    }
  });

  it('sin page ni limit devuelve el arreglo completo (compatibilidad)', async () => {
    const res = await ctx.api.get('/api/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
  });

  it('con page y limit devuelve { total, page, limit, totalPages, users } ordenados por id, sin passwordHash', async () => {
    const all = (await ctx.api.get('/api/users')).body as any[];
    const res = await ctx.api.get('/api/users?page=1&limit=3');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: all.length, page: 1, limit: 3, totalPages: Math.ceil(all.length / 3) });
    expect(res.body.users.map((u: any) => u.id)).toEqual(all.slice(0, 3).map((u) => u.id));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash/);
    expect(res.body.users[0]).toEqual(expect.objectContaining({ id: expect.any(Number), username: expect.any(String), role: expect.any(String) }));
  });

  it('las páginas no se repiten y juntas son todos los usuarios', async () => {
    const all = (await ctx.api.get('/api/users')).body as any[];
    const first = await ctx.api.get('/api/users?page=1&limit=4');
    const seen: number[] = [];
    for (let page = 1; page <= first.body.totalPages; page++) {
      const res = await ctx.api.get(`/api/users?page=${page}&limit=4`);
      seen.push(...res.body.users.map((u: any) => u.id));
    }
    expect(seen).toEqual(all.map((u) => u.id));
  });

  it('una página fuera de rango da lista vacía; solo ?limit usa la página 1; solo ?page usa 15 por página; el límite se recorta a 100', async () => {
    const all = (await ctx.api.get('/api/users')).body as any[];
    expect((await ctx.api.get('/api/users?page=99&limit=3')).body).toMatchObject({ total: all.length, page: 99, users: [] });
    expect((await ctx.api.get('/api/users?limit=2')).body).toMatchObject({ page: 1, limit: 2 });
    expect((await ctx.api.get('/api/users?page=1')).body).toMatchObject({ page: 1, limit: 15 });
    expect((await ctx.api.get('/api/users?page=1&limit=100000')).body.limit).toBe(100);
  });

  it('page o limit inválidos responden 400', async () => {
    for (const query of ['page=0', 'page=abc', 'limit=0', 'limit=-1', 'limit=2.5']) {
      const res = await ctx.api.get(`/api/users?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
  });
});
