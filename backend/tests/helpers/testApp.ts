/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * Uso típico:
 *   const ctx = useTestApp();          // registra beforeAll/afterAll e inicia sesión como Admin
 *   it('...', async () => { await ctx.api.get('/api/categories') ... });
 *
 * Toda la API exige token (salvo POST /api/auth/login), así que `ctx.api` ya lleva el de Admin.
 * Para probar sin sesión o con otro rol: `ctx.anon`, `ctx.loginAs(...)` y `ctx.createWorker()`.
 */
import fs from 'fs';
import path from 'path';
import supertest from 'supertest';
import app from '../../src/app';
import prisma from '../../src/prisma/client';
import { initializeDatabase } from '../../src/prisma/init';

export type Api = ReturnType<typeof supertest>;

/** Credenciales del administrador que siembra initializeDatabase(). */
export const ADMIN = { username: 'Admin', password: '123456' };

/** Secreto JWT de las pruebas (lo fija tests/setup/env.ts): sirve para firmar tokens "ajenos" o vencidos. */
export function testJwtSecret(): string {
  return process.env.JWT_SECRET as string;
}

/** Usuario tal como lo devuelve el login. */
export interface SessionUser {
  id: number;
  fullName: string;
  username: string;
  role: 'ADMIN' | 'WORKER';
  active: boolean;
  joinedAt: string;
}

/** Sesión iniciada: un cliente que adjunta su token en cada petición. */
export interface Session {
  api: Api;
  token: string;
  user: SessionUser;
}

/** Trabajador creado por `createWorker()`, con sus credenciales por si la prueba necesita iniciar sesión otra vez. */
export interface TestWorker extends Session {
  username: string;
  password: string;
}

/** Cliente supertest que adjunta `Authorization: Bearer <token>` en TODAS sus peticiones. */
export function clientWithToken(token: string): Api {
  return supertest.agent(app).set('Authorization', `Bearer ${token}`) as unknown as Api;
}

/** Inicia sesión por HTTP (sin cliente autenticado) y devuelve la respuesta tal cual. */
export function rawLogin(username: string, password: string) {
  return supertest(app).post('/api/auth/login').send({ username, password });
}

/** Inicia sesión y devuelve un cliente con el token; lanza si el login no responde 200. */
export async function loginAs(username: string, password: string): Promise<Session> {
  const res = await rawLogin(username, password);
  if (res.status !== 200 || typeof res.body.token !== 'string') {
    throw new Error(`No se pudo iniciar sesión como ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { api: clientWithToken(res.body.token), token: res.body.token, user: res.body.user };
}

let workerCounter = 0;

/**
 * Inicializa la BD temporal (migraciones + Admin + datos de ejemplo) antes del
 * archivo de prueba, inicia sesión como Admin y la limpia al terminar.
 * Devuelve:
 *  - `api`: cliente supertest autenticado como Admin (token en cada petición).
 *  - `anon`: cliente sin token.
 *  - `adminToken`: el token de Admin (disponible desde el primer `it`).
 *  - `loginAs(username, password)`: sesión de cualquier usuario.
 *  - `createWorker()`: crea (como Admin) un usuario WORKER activo y devuelve su sesión.
 */
export function useTestApp() {
  const adminAgent = supertest.agent(app);

  const ctx = {
    api: adminAgent as unknown as Api,
    anon: supertest(app) as Api,
    adminToken: '',
    loginAs,
    /** Crea un trabajador (rol WORKER, activo) con nombre único y contraseña `secreto1` salvo que se indique otra. */
    async createWorker(
      overrides: Partial<{ fullName: string; username: string; password: string; role: 'ADMIN' | 'WORKER' }> = {}
    ): Promise<TestWorker> {
      workerCounter += 1;
      const username = overrides.username ?? `trabajador${workerCounter}${Math.random().toString(36).slice(2, 6)}`;
      const password = overrides.password ?? 'secreto1';
      const res = await ctx.api.post('/api/users').send({
        fullName: overrides.fullName ?? `Trabajador de Prueba ${workerCounter}`,
        username,
        password,
        role: overrides.role ?? 'WORKER',
      });
      if (res.status !== 201) {
        throw new Error(`No se pudo crear el usuario ${username}: ${res.status} ${JSON.stringify(res.body)}`);
      }
      return { ...(await loginAs(username, password)), username, password };
    },
  };

  beforeAll(async () => {
    await initializeDatabase();
    const session = await loginAs(ADMIN.username, ADMIN.password);
    ctx.adminToken = session.token;
    adminAgent.set('Authorization', `Bearer ${session.token}`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    const dbPath = process.env.SQLITE_DB_PATH;
    if (dbPath) {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    }
  });

  return ctx;
}

/** Busca un id por nombre en una lista devuelta por la API (falla con mensaje claro). */
export function idByName<T extends { id: number; name: string }>(items: T[], name: string): number {
  const found = items.find((i) => i.name === name);
  if (!found) throw new Error(`No existe "${name}" en: ${items.map((i) => i.name).join(', ')}`);
  return found.id;
}

/** Abre caja con un conteo simple; útil antes de crear comandas. */
export async function openCaja(api: Api, denominations: Record<string, number> = { '1': 10, '20': 5 }) {
  const res = await api.post('/api/caja/open').send({ denominations });
  if (res.status !== 201) throw new Error(`No se pudo abrir caja: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Cierra caja (si hay una abierta) para dejar el estado limpio entre pruebas. */
export async function closeCaja(api: Api, denominations: Record<string, number> = { '1': 10 }) {
  return api.post('/api/caja/close').send({ denominations });
}
