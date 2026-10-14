/**
 * Operación: fallo rápido al arrancar. La lógica vive en `bootstrapServer` (src/startup.ts),
 * una función pura con dependencias inyectadas, así se prueba sin matar a Jest con process.exit.
 */
import type { Server } from 'http';
import { bootstrapServer } from '../../src/startup';

const fakeServer = { fake: true } as unknown as Server;

function setup(overrides: Partial<Parameters<typeof bootstrapServer>[0]> = {}) {
  const logger = { log: jest.fn(), error: jest.fn() };
  const exit = jest.fn();
  const listen = jest.fn((_port: number | string, callback: (error?: Error) => void) => {
    callback();
    return fakeServer;
  });
  const initializeDatabase = jest.fn(async () => undefined);
  const options = { port: 3999, app: { listen }, initializeDatabase, exit, logger, ...overrides };
  return { options, logger, exit, listen, initializeDatabase };
}

describe('arranque con fallo rápido (bootstrapServer)', () => {
  it('si initializeDatabase lanza: registra el error, termina con código 1 y NO abre el puerto', async () => {
    const failure = new Error('no such table: users');
    const { options, logger, exit, listen } = setup({
      initializeDatabase: jest.fn(async () => {
        throw failure;
      }),
    });

    const result = await bootstrapServer(options);

    expect(result).toBeNull();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(listen).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('base de datos'), failure);
  });

  it('si la BD se inicializa bien: abre el puerto, no llama a exit y devuelve el servidor', async () => {
    const { options, logger, exit, listen, initializeDatabase } = setup({ port: 4123 });

    const result = await bootstrapServer(options);

    expect(initializeDatabase).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenCalledWith(4123, expect.any(Function));
    expect(exit).not.toHaveBeenCalled();
    expect(result).toBe(fakeServer);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('4123'));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('la BD se inicializa ANTES de abrir el puerto', async () => {
    const order: string[] = [];
    const { options } = setup({
      initializeDatabase: jest.fn(async () => {
        order.push('init');
      }),
      app: {
        listen: jest.fn((_port, callback) => {
          order.push('listen');
          callback();
          return fakeServer;
        }),
      },
    });

    await bootstrapServer(options);
    expect(order).toEqual(['init', 'listen']);
  });

  it('si no se puede abrir el puerto (EADDRINUSE): registra, termina con código 1 y devuelve null', async () => {
    const portError = Object.assign(new Error('listen EADDRINUSE: address already in use :::3001'), { code: 'EADDRINUSE' });
    const { options, logger, exit } = setup({
      app: {
        listen: jest.fn((_port, callback) => {
          callback(portError);
          return fakeServer;
        }),
      },
    });

    const result = await bootstrapServer(options);

    expect(result).toBeNull();
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('puerto'), portError);
  });
});
