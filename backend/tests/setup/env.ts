/**
 * Se ejecuta ANTES de importar cualquier módulo de cada archivo de prueba
 * (setupFiles). Apunta Prisma/better-sqlite3 a una BD temporal exclusiva,
 * así las pruebas nunca tocan backend/prisma/dev.db y pueden correr en paralelo.
 */
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const unique = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
const dir = path.join(os.tmpdir(), `mf-jest-${unique}`);

process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = path.join(dir, 'test.db');
process.env.SQLITE_BACKUP_DIR = path.join(dir, 'backups');
process.env.DATABASE_URL = '';
process.env.FRONTEND_URL = '';

// Variables de seguridad/operación: vacías para que un backend/.env local no cambie el resultado
// de las pruebas (dotenv no pisa las variables ya definidas, ni siquiera vacías). Con NODE_ENV=test
// los límites de tasa son muy altos por defecto; las pruebas de límites inyectan los suyos.
for (const name of [
  'TRUST_PROXY',
  'CSP_REPORT_ONLY',
  'ADMIN_INITIAL_PASSWORD',
  'RATE_LIMIT_DISABLED',
  'RATE_LIMIT_LOGIN_MAX',
  'RATE_LIMIT_LOGIN_WINDOW_MS',
  'RATE_LIMIT_API_MAX',
  'RATE_LIMIT_API_WINDOW_MS',
]) {
  process.env[name] = '';
}
