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
