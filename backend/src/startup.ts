/**
 * ====================================================
 * ARRANQUE DEL SERVIDOR CON FALLO RÁPIDO
 * ====================================================
 * Lógica pura (sin tocar process ni abrir nada por sí misma) para poder probarla.
 * Si la BD no se inicializa o el puerto no se puede abrir, el proceso termina con
 * código 1: arrancar igual dejaba un servidor "vivo" cuyas rutas fallaban con
 * "no such table", y el health check de la plataforma lo daba por bueno.
 */

import type { Server } from 'http';

export interface BootstrapOptions {
  port: number | string;
  /** Normalmente la app Express: solo se usa su método listen. */
  app: { listen: (port: number | string, callback: (error?: Error) => void) => Server };
  /** Inicializa/migra la BD (initializeDatabase). Si lanza, no se arranca. */
  initializeDatabase: () => Promise<void>;
  /** Termina el proceso (process.exit en producción; un espía en pruebas). */
  exit: (code: number) => void;
  logger?: Pick<Console, 'log' | 'error'>;
}

/**
 * Inicializa la BD y abre el puerto. Devuelve el servidor, o `null` si falló
 * (en cuyo caso ya se llamó a `exit(1)`).
 */
export async function bootstrapServer(options: BootstrapOptions): Promise<Server | null> {
  const { port, app, initializeDatabase, exit, logger = console } = options;

  try {
    await initializeDatabase();
  } catch (dbErr) {
    logger.error('[Backend] Error crítico inicializando la base de datos. El servidor NO arrancará:', dbErr);
    exit(1);
    return null;
  }

  return new Promise<Server | null>((resolve) => {
    const server = app.listen(port, (listenErr?: Error) => {
      // Se resuelve en una microtarea: un `listen` simulado podría invocar el callback de forma
      // síncrona, antes de que `server` esté asignado.
      void Promise.resolve().then(() => {
        if (listenErr) {
          logger.error(`[Backend] No se pudo abrir el puerto ${port}:`, listenErr);
          exit(1);
          resolve(null);
          return;
        }
        logger.log(`🚀 POS Backend Server running on http://localhost:${port}`);
        resolve(server);
      });
    });
  });
}
