/**
 * ====================================================
 * INSTANCIA DE CONEXIÓN DE PRISMA CLIENT (SINGLETON)
 * ====================================================
 * Este archivo inicializa la conexión ORM con la base de datos SQLite
 * utilizando el adaptador oficial `@prisma/adapter-better-sqlite3`.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// 1. Obtener la ruta de la base de datos de manera dinámica (producción en Railway/VPS o desarrollo local)
const getDatabasePath = (): string => {
  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.env.SQLITE_DB_PATH);
  }
  if (process.env.DATABASE_URL) {
    return path.resolve(process.env.DATABASE_URL.replace(/^file:/, ''));
  }
  return path.resolve(process.cwd(), 'prisma/dev.db');
};

const dbPath = getDatabasePath();
console.log(`[PrismaClient] Conectando a SQLite en: ${dbPath}`);

// 2. Inicializar el adaptador de better-sqlite3 con la ruta especificada
const adapter = new PrismaBetterSqlite3({ url: dbPath });

// 3. Crear la instancia global del cliente Prisma reutilizando la conexión
const prisma = new PrismaClient({ adapter });

// Exportar la instancia singleton para usarla en todos los servicios de la aplicación
export default prisma;
