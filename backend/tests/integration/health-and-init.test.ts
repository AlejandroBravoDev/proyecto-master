import Database from 'better-sqlite3';
import { initializeDatabase } from '../../src/prisma/init';
import { useTestApp } from '../helpers/testApp';

const ctx = useTestApp();

describe('Health, 404 y arranque de la BD', () => {
  it('GET /health responde OK con marca de tiempo ISO', async () => {
    const res = await ctx.api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('una ruta inexistente responde 404 en español', async () => {
    const res = await ctx.api.get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ruta o endpoint no encontrado' });
  });

  it('helmet añade cabeceras de seguridad', async () => {
    const res = await ctx.api.get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('initializeDatabase es idempotente: no duplica Admin ni datos de ejemplo', async () => {
    await initializeDatabase();
    await initializeDatabase();

    const db = new Database(process.env.SQLITE_DB_PATH as string, { readonly: true });
    try {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE lower(username) = 'admin'").get() as { n: number };
      const cats = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
      expect(admins.n).toBe(1);
      expect(cats.n).toBe(3);
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally {
      db.close();
    }
  });
});
