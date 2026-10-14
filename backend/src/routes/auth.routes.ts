/**
 * ====================================================
 * RUTAS DE AUTENTICACIÓN (ROUTER LAYER)
 * ====================================================
 * Este router se monta ANTES de `authenticate` (routes/index.ts): el login es la única ruta
 * pública de la API. Cualquier ruta que se añada aquí debe llevar `authenticate` explícito
 * (la prueba-guardia de rutas falla si queda alguna abierta).
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Endpoint POST: Iniciar sesión local (PÚBLICO)
router.post('/login', (req, res) => authController.login(req, res));

// Endpoint GET: Usuario de la sesión actual, leído de la BD (requiere token)
router.get('/me', authenticate, (req, res) => authController.me(req, res));

export default router;
