/**
 * Utilidades compartidas por las pruebas de integración.
 *
 * Uso típico:
 *   const ctx = useTestApp();          // registra beforeAll/afterAll
 *   it('...', async () => { await ctx.api.get('/api/categories') ... });
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

/**
 * Inicializa la BD temporal (migraciones + Admin + datos de ejemplo) antes del
 * archivo de prueba y la limpia al terminar. Devuelve un cliente supertest.
 */
export function useTestApp() {
  const ctx = { api: supertest(app) as Api };

  beforeAll(async () => {
    await initializeDatabase();
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
