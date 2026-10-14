/**
 * ====================================================
 * APLICACIÓN EXPRESS (SIN LISTEN)
 * ====================================================
 * Middleware globales, montaje de rutas de la API, SPA estática y
 * manejo global de errores. Separada de server.ts para poder probarla
 * con supertest sin abrir un puerto.
 */

import dotenv from 'dotenv';
// Cargar variables de entorno desde el archivo .env
dotenv.config();

import path from 'path';
import fs from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index';

const app = express();

// 1. Security Middleware: Helmet añade cabeceras HTTP seguras (CSP deshabilitado para permitir recursos compilados de Vite)
app.use(helmet({ contentSecurityPolicy: false }));

// 2. CORS Middleware: Permite peticiones desde aplicaciones cliente (frontend)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

// 3. Logger Middleware: Registra en consola las peticiones HTTP entrantes (formato dev); silenciado en pruebas
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 4. Body Parsers: Convierte los cuerpos de peticiones JSON y URL-encoded a req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Endpoint de prueba de vida (Health Check)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 6. Montar todas las rutas REST del sistema en el prefijo /api
app.use('/api', apiRoutes);

// 7. Servir archivos estáticos del frontend en producción web (VPS / Dominio / Chromebook)
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

const frontendDist = resolveFrontendDist();
if (frontendDist) {
  if (process.env.NODE_ENV !== 'test') {
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

// 8. Middleware para rutas no encontradas (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta o endpoint no encontrado' });
});

// 9. Middleware de captura global de errores (500)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err.message || err });
});

export default app;
