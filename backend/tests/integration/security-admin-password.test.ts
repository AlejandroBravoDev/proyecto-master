/**
 * S2: el código ya no crea el acceso trivial Admin/123456 en producción.
 * Se prueba `initializeDatabase(env)` con un entorno de producción simulado y una BD temporal.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { DEV_ADMIN_PASSWORD, initializeDatabase, resolveAdminInitialPassword } from '../../src/prisma/init';
import { isValidPassword, verifyPassword } from '../../src/utils/auth.utils';

describe('S2: contraseña inicial del Admin', () => {
  let dir: string;
  let dbFile: string;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  const envFor = (extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv => ({
    SQLITE_DB_PATH: dbFile,
    SQLITE_BACKUP_DIR: path.join(dir, 'backups'),
    ...extra,
  });

  const adminHash = (): string => {
    const db = new Database(dbFile, { readonly: true });
    try {
      const row = db.prepare("SELECT password_hash AS h FROM users WHERE lower(username) = 'admin'").get() as { h: string };
      return row.h;
    } finally {
      db.close();
    }
  };

  /** Todo lo que initializeDatabase imprimió con console.warn, en una sola cadena. */
  const warned = () => warnSpy.mock.calls.map((call) => call.join(' ')).join('\n');

  /** Extrae la contraseña generada del aviso de arranque. */
  const generatedPassword = (): string => {
    const match = warned().match(/contraseña inicial GENERADA: (\S+)/);
    if (!match) throw new Error(`No se imprimió la contraseña generada. Avisos:\n${warned()}`);
    return match[1];
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-admin-'));
    dbFile = path.join(dir, 'pos.db');
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('producción sin ADMIN_INITIAL_PASSWORD: el Admin sembrado NO acepta 123456', async () => {
    await initializeDatabase(envFor({ NODE_ENV: 'production' }));

    const hash = adminHash();
    expect(verifyPassword(DEV_ADMIN_PASSWORD, hash)).toBe(false);
    expect(verifyPassword('123456', hash)).toBe(false);
    expect(verifyPassword('admin', hash)).toBe(false);
  });

  it('producción sin la variable: genera una contraseña fuerte y la imprime UNA sola vez', async () => {
    await initializeDatabase(envFor({ NODE_ENV: 'production' }));

    const password = generatedPassword();
    expect(password.length).toBeGreaterThanOrEqual(20);
    expect(isValidPassword(password)).toBe(true);
    expect(verifyPassword(password, adminHash())).toBe(true); // la que se imprimió es la real
    expect(warned()).toMatch(/NO se volverá a mostrar/);
    expect(warned().split(password).length - 1).toBe(1); // aparece exactamente una vez

    // Un segundo arranque (el Admin ya existe) no vuelve a imprimirla ni la cambia
    warnSpy.mockClear();
    await initializeDatabase(envFor({ NODE_ENV: 'production' }));
    expect(warned()).not.toContain(password);
    expect(warned()).not.toMatch(/GENERADA/);
    expect(verifyPassword(password, adminHash())).toBe(true);
  });

  it('cada instalación recibe una contraseña distinta', () => {
    const a = resolveAdminInitialPassword({ NODE_ENV: 'production' });
    const b = resolveAdminInitialPassword({ NODE_ENV: 'production' });
    expect(a.generated).toBe(true);
    expect(a.password).not.toBe(b.password);
  });

  it('producción con ADMIN_INITIAL_PASSWORD: se usa esa contraseña y no se escribe en el log', async () => {
    const chosen = 'Clave-Inicial-Larga-9!';
    await initializeDatabase(envFor({ NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: chosen }));

    expect(verifyPassword(chosen, adminHash())).toBe(true);
    expect(verifyPassword('123456', adminHash())).toBe(false);
    expect(warned()).not.toContain(chosen);
    expect(warned()).not.toMatch(/GENERADA/);
    expect(logSpy.mock.calls.map((c) => c.join(' ')).join('\n')).not.toContain(chosen);
  });

  it('desarrollo/pruebas sin la variable: 123456 como siempre (las pruebas dependen de ello)', async () => {
    await initializeDatabase(envFor({ NODE_ENV: 'test' }));
    expect(verifyPassword('123456', adminHash())).toBe(true);
    expect(warned()).not.toMatch(/GENERADA/);
  });

  it('desarrollo sin NODE_ENV tampoco genera contraseña aleatoria', async () => {
    await initializeDatabase(envFor({}));
    expect(verifyPassword('123456', adminHash())).toBe(true);
  });

  it('una ADMIN_INITIAL_PASSWORD demasiado corta se ignora con aviso (producción: aleatoria; dev: 123456)', async () => {
    await initializeDatabase(envFor({ NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: 'abc' }));
    expect(warned()).toMatch(/menos de 6 caracteres/);
    expect(verifyPassword('abc', adminHash())).toBe(false);
    expect(verifyPassword(generatedPassword(), adminHash())).toBe(true);

    expect(resolveAdminInitialPassword({ NODE_ENV: 'test', ADMIN_INITIAL_PASSWORD: 'abc' })).toEqual({
      password: DEV_ADMIN_PASSWORD,
      generated: false,
      warning: expect.stringMatching(/menos de 6/),
    });
  });

  it('una variable vacía cuenta como no definida', () => {
    expect(resolveAdminInitialPassword({ NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: '' }).generated).toBe(true);
    expect(resolveAdminInitialPassword({ NODE_ENV: 'test', ADMIN_INITIAL_PASSWORD: '  ' })).toEqual({
      password: DEV_ADMIN_PASSWORD,
      generated: false,
      warning: undefined,
    });
  });

  it('si el Admin ya existe (p. ej. la producción actual) no se toca su contraseña', async () => {
    await initializeDatabase(envFor({ NODE_ENV: 'test' })); // crea Admin/123456
    const before = adminHash();

    await initializeDatabase(envFor({ NODE_ENV: 'production', ADMIN_INITIAL_PASSWORD: 'Otra-Clave-Distinta-1' }));
    expect(adminHash()).toBe(before);
  });
});
