/**
 * B8 (parte de app.ts): cuerpo ausente, JSON inválido, cuerpo demasiado grande y errores
 * globales que no filtran objetos.
 */
import express from 'express';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { ensureBody } from '../../src/middleware/requestBody';
import { errorHandler, errorText } from '../../src/middleware/errorHandler';
import { useTestApp, ADMIN } from '../helpers/testApp';

useTestApp();

describe('B8: cuerpo ausente, JSON inválido y cuerpo demasiado grande', () => {
  const api = supertest(createApp());

  it('un POST sin cuerpo no rompe: el controller valida y responde 400 (antes 500)', async () => {
    const res = await api.post('/api/auth/login');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requeridos/i);
  });

  it('un POST sin cuerpo a otro recurso es un error de cliente (4xx), nunca un 500', async () => {
    const res = await api.post('/api/categories');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('Content-Type JSON con cuerpo vacío tampoco rompe', async () => {
    const res = await api.post('/api/auth/login').set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });

  it('JSON malformado responde 400 { error: "JSON inválido" } sin filtrar el SyntaxError', async () => {
    const res = await api
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": "Admin", "password": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'JSON inválido' });
  });

  it('JSON malformado en otro recurso de la API también es 400', async () => {
    const res = await api.post('/api/categories').set('Content-Type', 'application/json').send('{nombre: sin comillas}');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'JSON inválido' });
  });

  it('un cuerpo mayor que el límite (100kb) responde 413 en español', async () => {
    const res = await api
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: ADMIN.username, password: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/tamaño/i);
    expect(res.body.details).toBeUndefined();
  });

  it('un cuerpo de menos de 100kb sigue pasando', async () => {
    const res = await api
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ username: ADMIN.username, password: 'x'.repeat(50 * 1024) }));
    expect(res.status).toBe(401);
  });

  it('los formularios urlencoded siguen funcionando', async () => {
    const res = await api
      .post('/api/auth/login')
      .type('form')
      .send({ username: ADMIN.username, password: ADMIN.password });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('ensureBody deja {} solo cuando falta el cuerpo y respeta el existente', () => {
    const next = jest.fn();
    const missing: any = {};
    ensureBody(missing, {} as any, next);
    expect(missing.body).toEqual({});

    const nulled: any = { body: null };
    ensureBody(nulled, {} as any, next);
    expect(nulled.body).toEqual({});

    const present: any = { body: { a: 1 } };
    ensureBody(present, {} as any, next);
    expect(present.body).toEqual({ a: 1 });
    expect(next).toHaveBeenCalledTimes(3);
  });
});

describe('manejo global de errores: details solo como texto', () => {
  const buildApp = (thrown: unknown) => {
    const app = express();
    app.get('/boom', () => {
      throw thrown;
    });
    app.use(errorHandler);
    return supertest(app);
  };

  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => spy.mockRestore());

  it('un Error normal devuelve su mensaje como texto', async () => {
    const res = await buildApp(new Error('algo falló')).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor', details: 'algo falló' });
  });

  it('un objeto de error de Prisma (con propiedades internas) no se filtra: details es un string', async () => {
    const prismaLike = { name: 'PrismaClientValidationError', clientVersion: '7.8.0', message: 'Invalid `prisma.x()`', meta: { secret: 1 } };
    const res = await buildApp(prismaLike).get('/boom');
    expect(res.status).toBe(500);
    expect(typeof res.body.details).toBe('string');
    expect(res.body.details).toBe('Invalid `prisma.x()`');
    expect(JSON.stringify(res.body)).not.toMatch(/clientVersion|secret/);
  });

  it('un valor lanzado sin message se reemplaza por un texto genérico, no por el objeto', async () => {
    const res = await buildApp({ code: 'P2003', meta: { field_name: 'category_id' } }).get('/boom');
    expect(res.status).toBe(500);
    expect(typeof res.body.details).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/P2003|field_name/);
    expect(errorText(undefined)).toBe('Error desconocido');
    expect(errorText('texto')).toBe('texto');
  });
});
