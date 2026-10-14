import { useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

describe('/api/caja (turnos y arqueos)', () => {
  let sessionId: number;

  it('GET /status con caja cerrada y sin historial', async () => {
    const res = await ctx.api.get('/api/caja/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isOpen: false, activeSession: null });
  });

  it('POST /close sin sesión abierta -> 400', async () => {
    const res = await ctx.api.post('/api/caja/close').send({ denominations: { '1': 1 } });
    expect(res.status).toBe(400);
  });

  it('POST /open exige denominaciones', async () => {
    expect((await ctx.api.post('/api/caja/open').send({})).status).toBe(400);
  });

  it('POST /open calcula la base en el servidor (objeto, claves normalizadas, ignora inválidos)', async () => {
    const res = await ctx.api.post('/api/caja/open').send({
      denominations: { '0.05': 10, '1.00': 30, '20': 2, '5': 0, '-3': 4 },
      initialAmount: 99999, // el cliente no manda: debe ignorarse
      notes: 'Turno mañana',
      userId: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.initialAmount).toBe(70.5); // 0.5 + 30 + 40
    expect(res.body.initialDenominations).toEqual({ '0.05': 10, '1': 30, '20': 2 });
    expect(res.body.status).toBe('OPEN');
    expect(res.body.sessionNumber).toMatch(/^CAJA-\d{4}-0001$/);
    expect(res.body.openedByUser).toMatchObject({ username: 'Admin' });
    sessionId = res.body.id;
  });

  it('POST /open con una sesión abierta -> 400 (solo una a la vez)', async () => {
    const res = await ctx.api.post('/api/caja/open').send({ denominations: { '1': 1 } });
    expect(res.status).toBe(400);
  });

  it('GET /status muestra la sesión activa', async () => {
    const res = await ctx.api.get('/api/caja/status');
    expect(res.body.isOpen).toBe(true);
    expect(res.body.activeSession.id).toBe(sessionId);
  });

  it('acepta denominaciones en formato arreglo [{ value, count }]', async () => {
    // Se verifica al cerrar, porque la apertura ya se hizo con objeto
    const res = await ctx.api.post('/api/caja/close').send({
      denominations: [
        { value: 0.5, count: 4 },
        { value: 10, count: 3 },
      ],
      closingNotes: 'Cuadra',
      userId: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.finalAmount).toBe(32); // 2 + 30
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.closingNotes).toBe('Cuadra');
    expect(res.body.closedAt).toBeTruthy();
  });

  it('GET /status tras cerrar incluye lastClosedSession', async () => {
    const res = await ctx.api.get('/api/caja/status');
    expect(res.body.isOpen).toBe(false);
    expect(res.body.lastClosedSession.id).toBe(sessionId);
  });

  it('el número de sesión es correlativo', async () => {
    const second = await ctx.api.post('/api/caja/open').send({ denominations: { '1': 5 } });
    expect(second.body.sessionNumber).toMatch(/-0002$/);
    await ctx.api.post('/api/caja/close').send({ denominations: { '1': 5 } });
  });

  it('PUT /:id corrige montos y notas; 404 si no existe', async () => {
    const res = await ctx.api.put(`/api/caja/${sessionId}`).send({ finalAmount: 33, closingNotes: 'Corregido' });
    expect(res.status).toBe(200);
    expect(res.body.finalAmount).toBe(33);
    expect(res.body.closingNotes).toBe('Corregido');

    expect((await ctx.api.put('/api/caja/999999').send({ notes: 'x' })).status).toBe(404);
  });

  it('GET /history pagina y GET /session/:id devuelve el detalle con desgloses parseados', async () => {
    const history = await ctx.api.get('/api/caja/history?limit=1&page=1');
    expect(history.status).toBe(200);
    expect(history.body).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(history.body.sessions).toHaveLength(1);

    const detail = await ctx.api.get(`/api/caja/session/${sessionId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.initialDenominations).toEqual({ '0.05': 10, '1': 30, '20': 2 });
    expect((await ctx.api.get('/api/caja/session/999999')).status).toBe(404);
  });
});

describe('/api/caja validaciones de entrada', () => {
  it('PUT /:id valida los importes y las notas (400) sin modificar la sesión', async () => {
    const [first] = (await ctx.api.get('/api/caja/history?limit=1&page=2')).body.sessions;
    const before = (await ctx.api.get(`/api/caja/session/${first.id}`)).body;

    const bad: Array<[string, Record<string, unknown>]> = [
      ['importe negativo', { finalAmount: -5 }],
      ['importe no numérico', { initialAmount: 'mucho' }],
      ['nota que no es texto', { notes: 12 }],
      ['nota de cierre que no es texto', { closingNotes: {} }],
    ];
    for (const [label, body] of bad) {
      const res = await ctx.api.put(`/api/caja/${first.id}`).send(body);
      expect([label, res.status]).toEqual([label, 400]);
      expect(typeof res.body.error).toBe('string');
    }
    expect((await ctx.api.get(`/api/caja/session/${first.id}`)).body).toEqual(before);
  });

  it('POST /open con un userId inválido o inexistente responde 400 y no abre la caja', async () => {
    for (const userId of ['abc', -1, 999999]) {
      const res = await ctx.api.post('/api/caja/open').send({ denominations: { '1': 5 }, userId });
      expect([String(userId), res.status]).toEqual([String(userId), 400]);
      expect(res.body.error).toMatch(/userId|usuario/i);
    }
    expect((await ctx.api.get('/api/caja/status')).body.isOpen).toBe(false);
  });

  it('POST /close con un userId inválido responde 400 y la caja sigue abierta', async () => {
    const open = await ctx.api.post('/api/caja/open').send({ denominations: { '1': 5 } });
    expect(open.status).toBe(201);

    const res = await ctx.api.post('/api/caja/close').send({ denominations: { '1': 5 }, userId: 'abc' });
    expect(res.status).toBe(400);
    expect((await ctx.api.get('/api/caja/status')).body.isOpen).toBe(true);

    const missingUser = await ctx.api.post('/api/caja/close').send({ denominations: { '1': 5 }, userId: 999999 });
    expect(missingUser.status).toBe(400);
    expect((await ctx.api.get('/api/caja/status')).body.isOpen).toBe(true);

    expect((await ctx.api.post('/api/caja/close').send({ denominations: { '1': 5 }, userId: 1 })).status).toBe(200);
  });

  it('GET /history rechaza page, limit y openedByUserId inválidos y recorta el límite a 200', async () => {
    for (const query of ['page=0', 'page=x', 'limit=0', 'limit=-1', 'limit=abc', 'openedByUserId=abc']) {
      const res = await ctx.api.get(`/api/caja/history?${query}`);
      expect([query, res.status]).toEqual([query, 400]);
    }
    expect((await ctx.api.get('/api/caja/history?limit=100000')).body.limit).toBe(200);
    // sin parámetros usa 20 por página y la página 1
    expect((await ctx.api.get('/api/caja/history')).body).toMatchObject({ page: 1, limit: 20 });
  });
});
