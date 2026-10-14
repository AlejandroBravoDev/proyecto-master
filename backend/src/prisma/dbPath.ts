/**
 * ====================================================
 * RESOLUCIÓN CENTRALIZADA DE LA RUTA DE LA BASE DE DATOS
 * ====================================================
 * Antes, `client.ts` e `init.ts` resolvían la ruta cada uno por su cuenta y las
 * rutas relativas dependían del directorio desde el que se arrancaba el proceso
 * (cwd): arrancar desde la raíz del repo abría OTRA base de datos vacía.
 *
 * Ahora las rutas relativas (`file:./dev.db`, `prisma/dev.db`) se resuelven
 * siempre contra la raíz del backend, sea cual sea el cwd. Una ruta absoluta
 * (p. ej. `SQLITE_DB_PATH=/data/dev.db` en el volumen de Railway) se respeta tal cual.
 *
 * Prioridad: SQLITE_DB_PATH > DATABASE_URL > <raíz del backend>/prisma/dev.db
 */

import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Raíz del backend (la carpeta con package.json, prisma/ y dist/).
 * Desde `src/prisma` (ts-node) o `dist/prisma` (compilado) son dos niveles hacia arriba.
 */
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

const clean = (value: string | undefined): string => (value ?? '').trim();

/** Convierte una DATABASE_URL de SQLite (`file:./dev.db`, `file:///C:/x/dev.db`) en una ruta de archivo. */
export function filePathFromDatabaseUrl(url: string): string {
  const withoutQuery = url.split('?')[0];
  if (/^file:\/\//i.test(withoutQuery)) {
    return fileURLToPath(withoutQuery);
  }
  return withoutQuery.replace(/^file:/i, '');
}

/** Ruta ABSOLUTA del archivo SQLite, independiente del directorio de arranque. */
export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicitPath = clean(env.SQLITE_DB_PATH);
  if (explicitPath) {
    return path.resolve(BACKEND_ROOT, explicitPath);
  }

  const databaseUrl = clean(env.DATABASE_URL);
  if (databaseUrl) {
    return path.resolve(BACKEND_ROOT, filePathFromDatabaseUrl(databaseUrl));
  }

  return path.resolve(BACKEND_ROOT, 'prisma', 'dev.db');
}

/**
 * Carpeta de copias de seguridad: `SQLITE_BACKUP_DIR` o, por defecto, `backups`
 * junto a la carpeta de la BD (mismo comportamiento histórico).
 */
export function resolveBackupDir(dbPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const explicitDir = clean(env.SQLITE_BACKUP_DIR);
  if (explicitDir) {
    return path.resolve(BACKEND_ROOT, explicitDir);
  }
  return path.resolve(path.dirname(dbPath), '..', 'backups');
}
