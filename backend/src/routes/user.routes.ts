/**
 * ====================================================
 * RUTAS DE USUARIOS Y PERSONAL (ROUTER LAYER)
 * ====================================================
 */

import { Router } from 'express';
import { userController } from '../controllers/user.controller';

const router = Router();

// Endpoint GET: Listar todos los usuarios
router.get('/', (req, res) => userController.getUsers(req, res));

// Endpoint GET: Obtener un usuario por ID
router.get('/:id', (req, res) => userController.getUserById(req, res));

// Endpoint POST: Crear un nuevo usuario / trabajador
router.post('/', (req, res) => userController.createUser(req, res));

// Endpoint PUT: Actualizar datos de un usuario
router.put('/:id', (req, res) => userController.updateUser(req, res));

// Endpoint PATCH: Actualizar contraseña de un usuario
router.patch('/:id/password', (req, res) => userController.updatePassword(req, res));

// Endpoint PATCH: Cambiar estado activo/inactivo de un usuario
router.patch('/:id/status', (req, res) => userController.updateStatus(req, res));

export default router;
