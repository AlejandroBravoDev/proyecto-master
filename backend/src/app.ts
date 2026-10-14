/**
 * ====================================================
 * APLICACIÓN EXPRESS (SIN LISTEN)
 * ====================================================
 * Middleware globales, montaje de rutas de la API, SPA estática y
 * manejo global de errores. Separada de server.ts para poder probarla
 * con supertest sin abrir un puerto.
 *
 * `createApp(options)` construye una app nueva leyendo el entorno EN ESE MOMENTO
 * (límites de tasa, trust proxy), de modo que las pruebas pueden crear
 * apps con configuración inyectada. El `export default` es la app de producción.
 */

import path from 'path';
import dotenv from 'dotenv';
// Cargar variables de entorno desde backend/.env (relativo al backend, no al cwd)
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

import fs from 'fs';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index';
import { createRateLimiters, readRateLimitConfig, RateLimitConfig } from './middleware/rateLimit';
import { resolveTrustProxy } from './middleware/security';

export interface AppOptions {
  /** Entorno con el que se configura la app (por defecto process.env). Solo se inyecta en pruebas. */
  env?: NodeJS.ProcessEnv;
  /** Sobrescribe campos de la configuración de límites de tasa leída del entorno. */
  rateLimit?: Partial<RateLimitConfig>;
  /** Carpeta del frontend compilado: `undefined` = autodetectar, `null` = no servir el SPA. */
  frontendDist?: string | null;
  /** Registrar cada petición con morgan (por defecto sí, salvo NODE_ENV=test). */
  requestLogger?: boolean;
}

/** Busca el frontend compilado junto al backend (varios layouts de despliegue). */
const resolveFrontendDist = (): string | null => {
  const candidates = [
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist'),
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../frontend/dist'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
};

export function createApp(options: AppOptions = {}): Express {
  const env = options.env ?? process.env;
  const isTest = env.NODE_ENV === 'test';

  const app = express();

  // 0. Detrás del proxy de Railway/Render la IP real viene en X-Forwarded-For: sin esto todos los
  //    clientes comparten la IP del proxy (un único cupo de límite de tasa para todo el mundo).
  app.set('trust proxy', resolveTrustProxy(env));

  // 1. Security Middleware: Helmet añade cabeceras HTTP seguras (CSP deshabilitado para permitir recursos compilados de Vite)
  app.use(helmet({ contentSecurityPolicy: false }));

  // 2. CORS Middleware: Permite peticiones desde aplicaciones cliente (frontend)
  const allowedOrigins = env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map((url) => url.trim()) : true;

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    })
  );

  // 3. Logger Middleware: Registra en consola las peticiones HTTP entrantes (formato dev); silenciado en pruebas
  if (options.requestLogger ?? !isTest) {
    app.use(morgan('dev'));
  }

  // 4. Límites de tasa por IP (antes de parsear cuerpos y de montar las rutas). Van después de CORS
  //    para que las respuestas 429 lleven cabeceras CORS y el navegador pueda leerlas. /health queda fuera.
  const rateLimitConfig: RateLimitConfig = { ...readRateLimitConfig(env), ...options.rateLimit };
  if (rateLimitConfig.disabled) {
    if (!isTest) {
      console.warn('[Seguridad] RATE_LIMIT_DISABLED=true: los límites de tasa están DESACTIVADOS.');
    }
  } else {
    const limiters = createRateLimiters(rateLimitConfig);
    app.use('/api', limiters.api);
    app.post('/api/auth/login', limiters.login);
  }

  // 5. Body Parsers: Convierte los cuerpos de peticiones JSON y URL-encoded a req.body
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 6. Endpoint de prueba de vida (Health Check)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // 7. Montar todas las rutas REST del sistema en el prefijo /api
  app.use('/api', apiRoutes);

  // 8. Servir archivos estáticos del frontend en producción web (VPS / Dominio / Chromebook)
  const frontendDist = options.frontendDist === undefined ? resolveFrontendDist() : options.frontendDist;
  if (frontendDist) {
    if (!isTest) {
      console.log(`[Frontend Web] Sirviendo interfaz de usuario desde: ${frontendDist}`);
    }
    app.use(express.static(frontendDist));

    // Redirigir cualquier ruta que no sea /api ni /health al index.html de React (SPA Client Routing)
    app.get('{*splat}', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // 9. Middleware para rutas no encontradas (404)
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta o endpoint no encontrado' });
  });

  // 10. Middleware de captura global de errores (500)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Error interno del servidor', details: err.message || err });
  });

  return app;
}

const app = createApp();

export default app;
