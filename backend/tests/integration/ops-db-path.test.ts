/**
 * Operación: ruta de la BD independiente del directorio de arranque y copia previa a las
 * migraciones. No usa useTestApp(): trabaja con BDs temporales propias vía `initializeDatabase(env)`.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import {
  BACKEND_ROOT,
  filePathFromDatabaseUrl,
  resolveBackupDir,
  resolveDbPath,
} from '../../src/prisma/dbPath';
import {
  MIGRATION_IDS,
  getPendingMigrations,
  initializeDatabase,
  preMigrationBackupName,
} from '../../src/prisma/init';

describe('resolución de la ruta de la BD (dbPath.ts)', () => {
  it('BACKEND_ROOT es la carpeta del backend (package.json "backend", prisma/ y src/)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('backend');
    expect(fs.existsSync(path.join(BACKEND_ROOT, 'prisma', 'schema.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(BACKEND_ROOT, 'src', 'prisma', 'dbPath.ts'))).toBe(true);
  });

  it('las rutas relativas se resuelven contra la raíz del backend, NO contra el cwd', () => {
    const originalCwd = process.cwd();
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-cwd-'));
    try {
      process.chdir(elsewhere); // arrancar "desde otro directorio" (p. ej. la raíz del repo o C:\)
      expect(path.resolve('.')).not.toBe(BACKEND_ROOT);

      expect(resolveDbPath({ DATABASE_URL: 'file:./dev.db' })).toBe(path.join(BACKEND_ROOT, 'dev.db'));
      expect(resolveDbPath({ DATABASE_URL: 'file:prisma/dev.db' })).toBe(path.join(BACKEND_ROOT, 'prisma', 'dev.db'));
      expect(resolveDbPath({ SQLITE_DB_PATH: 'data/pos.db' })).toBe(path.join(BACKEND_ROOT, 'data', 'pos.db'));
      expect(resolveDbPath({})).toBe(path.join(BACKEND_ROOT, 'prisma', 'dev.db'));
      expect(resolveBackupDir(path.join(BACKEND_ROOT, 'prisma', 'dev.db'), { SQLITE_BACKUP_DIR: 'respaldo' })).toBe(
        path.join(BACKEND_ROOT, 'respaldo')
      );
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('el resultado es idéntico con cualquier cwd (arrancar desde backend/ o desde otro sitio)', () => {
    const originalCwd = process.cwd();
    const env = { DATABASE_URL: 'file:./dev.db' };
    try {
      process.chdir(BACKEND_ROOT);
      const fromBackend = resolveDbPath(env);
      process.chdir(os.tmpdir());
      expect(resolveDbPath(env)).toBe(fromBackend);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('una ruta absoluta (SQLITE_DB_PATH en un volumen) se respeta tal cual', () => {
    const absolute = path.join(os.tmpdir(), 'volumen', 'dev.db');
    expect(resolveDbPath({ SQLITE_DB_PATH: absolute })).toBe(absolute);
    expect(resolveDbPath({ DATABASE_URL: `file:${absolute}` })).toBe(absolute);
    expect(resolveBackupDir(absolute, { SQLITE_BACKUP_DIR: path.join(os.tmpdir(), 'volumen', 'backups') })).toBe(
      path.join(os.tmpdir(), 'volumen', 'backups')
    );
  });

  it('SQLITE_DB_PATH gana sobre DATABASE_URL; las variables vacías se ignoran', () => {
    const absolute = path.join(os.tmpdir(), 'gana.db');
    expect(resolveDbPath({ SQLITE_DB_PATH: absolute, DATABASE_URL: 'file:./otra.db' })).toBe(absolute);
    expect(resolveDbPath({ SQLITE_DB_PATH: '', DATABASE_URL: '' })).toBe(path.join(BACKEND_ROOT, 'prisma', 'dev.db'));
    expect(resolveDbPath({ SQLITE_DB_PATH: '   ', DATABASE_URL: 'file:./dev.db' })).toBe(path.join(BACKEND_ROOT, 'dev.db'));
  });

  it('filePathFromDatabaseUrl quita file:, la query y entiende file:///', () => {
    expect(filePathFromDatabaseUrl('file:./dev.db')).toBe('./dev.db');
    expect(filePathFromDatabaseUrl('file:./dev.db?connection_limit=1')).toBe('./dev.db');
    const absolute = path.join(os.tmpdir(), 'x.db');
    const asUrl = `file:///${absolute.replace(/\\/g, '/').replace(/^\//, '')}`;
    expect(path.resolve(filePathFromDatabaseUrl(asUrl))).toBe(path.resolve(absolute));
  });

  it('sin SQLITE_BACKUP_DIR, los backups van en "backups" junto a la carpeta de la BD (comportamiento histórico)', () => {
    const db = path.join(BACKEND_ROOT, 'prisma', 'dev.db');
    expect(resolveBackupDir(db, {})).toBe(path.join(BACKEND_ROOT, 'backups'));
    const dbInBackendRoot = path.join(BACKEND_ROOT, 'dev.db');
    expect(resolveBackupDir(dbInBackendRoot, {})).toBe(path.resolve(BACKEND_ROOT, '..', 'backups'));
  });
});

describe('copia previa a la migración (pre-migration-<fecha>.db)', () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;
  let dbFile: string;
  let backupDir: string;
  let logSpy: jest.SpyInstance;

  // Solo los .db: al abrir una copia en modo WAL SQLite crea archivos -wal/-shm al lado
  const backups = () => fs.readdirSync(backupDir).filter((name) => name.endsWith('.db')).sort();
  const preMigrationBackups = () => backups().filter((name) => name.startsWith('pre-migration-'));
  const withDb = <T>(file: string, fn: (db: Database.Database) => T, readonly = false): T => {
    const db = new Database(file, { readonly });
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-ops-'));
    dbFile = path.join(dir, 'pos.db');
    backupDir = path.join(dir, 'backups');
    env = { NODE_ENV: 'test', SQLITE_DB_PATH: dbFile, SQLITE_BACKUP_DIR: backupDir };
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('getPendingMigrations y preMigrationBackupName (funciones puras)', () => {
    expect(getPendingMigrations([])).toEqual([...MIGRATION_IDS]);
    expect(getPendingMigrations(['001_initial_schema'])).toEqual(['002_users_auth_and_session_orders']);
    expect(getPendingMigrations([...MIGRATION_IDS, '999_futura'])).toEqual([]);
    expect(preMigrationBackupName(new Date('2026-10-13T18:20:11.123Z'))).toBe('pre-migration-2026-10-13T18-20-11-123Z.db');
  });

  it('una BD nueva NO genera copia previa (solo el backup diario) y una segunda ejecución tampoco', async () => {
    await initializeDatabase(env);
    expect(preMigrationBackups()).toEqual([]);
    expect(backups()).toEqual([expect.stringMatching(/^backup-\d{4}-\d{2}-\d{2}\.db$/)]);

    await initializeDatabase(env);
    expect(preMigrationBackups()).toEqual([]);
  });

  it('con una migración pendiente sobre una BD con datos, hace la copia ANTES de migrar y la copia es el estado previo', async () => {
    await initializeDatabase(env);

    // Simula una instalación anterior a la migración 002 (el SQL de 002 es idempotente)
    withDb(dbFile, (db) => db.prepare('DELETE FROM "_migrations" WHERE id = ?').run('002_users_auth_and_session_orders'));

    await initializeDatabase(env);

    const copies = preMigrationBackups();
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatch(/^pre-migration-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db$/);

    // La copia contiene los datos y el estado ANTERIOR (sin la migración 002 registrada)
    withDb(
      path.join(backupDir, copies[0]),
      (db) => {
        const applied = (db.prepare('SELECT id FROM "_migrations"').all() as Array<{ id: string }>).map((r) => r.id);
        expect(applied).toEqual(['001_initial_schema']);
        expect((db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n).toBe(3);
        expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(1);
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
      },
      true
    );

    // La BD real quedó migrada
    withDb(
      dbFile,
      (db) => {
        const applied = (db.prepare('SELECT id FROM "_migrations"').all() as Array<{ id: string }>).map((r) => r.id);
        expect(applied).toEqual(expect.arrayContaining([...MIGRATION_IDS]));
      },
      true
    );

    // Ya sin pendientes: no se crea otra copia
    await initializeDatabase(env);
    expect(preMigrationBackups()).toHaveLength(1);
  });

  it('una BD con tablas pero sin tabla _migrations (instalación antigua) también se copia antes de migrar', async () => {
    await initializeDatabase(env);
    withDb(dbFile, (db) => db.exec('DROP TABLE "_migrations"'));

    await initializeDatabase(env);

    expect(preMigrationBackups()).toHaveLength(1);
    // Los datos siguen intactos y no se resembró nada
    withDb(
      dbFile,
      (db) => {
        expect((db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n).toBe(3);
        expect((db.prepare("SELECT COUNT(*) AS n FROM users WHERE lower(username) = 'admin'").get() as { n: number }).n).toBe(1);
      },
      true
    );
  });

  it('si no se puede crear la copia previa, initializeDatabase lanza y NO migra', async () => {
    await initializeDatabase(env);
    withDb(dbFile, (db) => db.prepare('DELETE FROM "_migrations" WHERE id = ?').run('002_users_auth_and_session_orders'));

    // Congela SOLO la fecha para saber cómo se llamará la copia y ocupar ese nombre con una carpeta:
    // db.backup() no puede escribir ahí y la copia previa falla.
    const now = new Date('2026-01-02T03:04:05.006Z');
    fs.mkdirSync(path.join(backupDir, preMigrationBackupName(now)), { recursive: true });
    jest.useFakeTimers({
      now,
      doNotFake: [
        'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
        'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
        'clearInterval', 'setTimeout', 'clearTimeout',
      ],
    });
    try {
      await expect(initializeDatabase(env)).rejects.toThrow(/copia previa/i);
    } finally {
      jest.useRealTimers();
    }

    withDb(
      dbFile,
      (db) => {
        const applied = (db.prepare('SELECT id FROM "_migrations"').all() as Array<{ id: string }>).map((r) => r.id);
        expect(applied).not.toContain('002_users_auth_and_session_orders');
      },
      true
    );
  });
});
