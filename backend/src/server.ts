/**
 * ====================================================
 * PUNTO DE ENTRADA PRINCIPAL DEL SERVIDOR
 * ====================================================
 * Inicializa la base de datos y levanta el servidor HTTP.
 * La aplicación Express (middleware, rutas, errores) vive en app.ts
 * para poder importarla en las pruebas sin abrir un puerto.
 */

import dotenv from 'dotenv';
// Cargar variables de entorno desde el archivo .env
dotenv.config();

import app from './app';
import { initializeDatabase } from './prisma/init';

const PORT = process.env.PORT || 3001;

let server: any = null;

// Inicializar base de datos y arrancar servidor
async function startServer() {
  try {
    await initializeDatabase();
  } catch (dbErr) {
    console.error('[Backend] Error crítico inicializando base de datos:', dbErr);
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 POS Backend Server running on http://localhost:${PORT}`);
  });
}

startServer();

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
