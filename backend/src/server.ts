/**
 * ====================================================
 * PUNTO DE ENTRADA PRINCIPAL DEL SERVIDOR EXPRESS
 * ====================================================
 * Carga variables de entorno, middleware globales,
 * montaje de rutas de la API y manejo global de errores.
 */

import dotenv from 'dotenv';
// Cargar variables de entorno desde el archivo .env
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index';

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Security Middleware: Helmet añade cabeceras HTTP seguras
app.use(helmet());

// 2. CORS Middleware: Permite peticiones desde aplicaciones cliente (frontend)
app.use(cors());

// 3. Logger Middleware: Registra en consola las peticiones HTTP entrantes (formato dev)
app.use(morgan('dev'));

// 4. Body Parsers: Convierte los cuerpos de peticiones JSON y URL-encoded a req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Endpoint de prueba de vida (Health Check)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 6. Montar todas las rutas REST del sistema en el prefijo /api
app.use('/api', apiRoutes);

// 7. Middleware para rutas no encontradas (404)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta o endpoint no encontrado' });
});

// 8. Middleware de captura global de errores (500)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Error interno del servidor', details: err.message || err });
});

// 9. Iniciar la escucha del servidor en el puerto especificado
app.listen(PORT, () => {
  console.log(`🚀 POS Backend Server running on http://localhost:${PORT}`);
});

export default app;
