/**
 * ====================================================
 * RUTAS DE PRODUCTOS (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP a las acciones de ProductController.
 */

import { Router } from 'express';
import { productController } from '../controllers/product.controller';

const router = Router();

// Endpoint GET: Consultar productos con filtros opcionales por Query Params
router.get('/', (req, res) => productController.getProducts(req, res));

// Endpoint GET: Consultar producto específico por ID
router.get('/:id', (req, res) => productController.getProductById(req, res));

// Endpoint POST: Registrar un nuevo producto (con o sin receta)
router.post('/', (req, res) => productController.createProduct(req, res));

// Endpoint PUT: Modificar un producto existente
router.put('/:id', (req, res) => productController.updateProduct(req, res));

// Endpoint DELETE: Eliminar un producto
router.delete('/:id', (req, res) => productController.deleteProduct(req, res));

export default router;
