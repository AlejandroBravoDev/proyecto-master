/**
 * ====================================================
 * PUNTO DE ENTRADA PRINCIPAL DEL SERVIDOR
 * ====================================================
 * Inicializa la base de datos y levanta el servidor HTTP.
 * La aplicación Express (middleware, rutas, errores) vive en app.ts
 * para poder importarla en las pruebas sin abrir un puerto.
 * La secuencia de arranque (con fallo rápido) vive en startup.ts.
 */

import path from 'path';
import dotenv from 'dotenv';
// Cargar variables de entorno desde backend/.env (relativo al backend, no al cwd)
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

import type { Server } from 'http';
import app from './app';
import { initializeDatabase } from './prisma/init';
import { bootstrapServer } from './startup';

const PORT = process.env.PORT || 3001;

// Con NODE_ENV sin definir se aplican los valores de desarrollo (sin trust proxy, Admin 123456 en BD nueva...).
// En Railway/Render hay que definir NODE_ENV=production: se avisa si se detecta esa plataforma.
if (process.env.NODE_ENV !== 'production' && (process.env.RAILWAY_ENVIRONMENT || process.env.RENDER)) {
  console.warn(
    '[Seguridad] Parece un despliegue en la nube pero NODE_ENV no es "production": ' +
      'define NODE_ENV=production (trust proxy, CORS cerrado y contraseña de Admin aleatoria dependen de ello).'
  );
}

let server: Server | null = null;

// Inicializar base de datos y arrancar servidor. Si la BD falla, el proceso termina con código 1.
bootstrapServer({
  port: PORT,
  app,
  initializeDatabase: () => initializeDatabase(),
  exit: (code) => process.exit(code),
}).then((started) => {
  server = started;
});

// Manejo de señales de terminación para cierre limpio (SIGTERM / SIGINT para Railway / Docker / Cloud)
const handleShutdown = (signal: string) => {
  console.log(`Recibida señal ${signal}. Cerrando servidor Express limpiamente...`);
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Si no se cierra en 3 segundos, forzar salida
  setTimeout(() => {
    console.error('Forzando cierre por tiempo de espera...');
    process.exit(1);
  }, 3000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
