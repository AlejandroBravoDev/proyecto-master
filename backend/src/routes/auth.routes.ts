/**
 * ====================================================
 * RUTAS DE AUTENTICACIÓN (ROUTER LAYER)
 * ====================================================
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

// Endpoint POST: Iniciar sesión local
router.post('/login', (req, res) => authController.login(req, res));

export default router;
