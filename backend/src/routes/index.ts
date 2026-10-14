/**
 * ====================================================
 * ENRUTADOR CENTRAL / MASTER ROUTER
 * ====================================================
 * Agrupa y monta los submódulos de rutas bajo el prefijo `/api`.
 *
 * SEGURIDAD: `/auth` se monta primero y es PÚBLICO (solo `POST /auth/login` lo es; `/auth/me`
 * lleva su propio `authenticate`). Desde `router.use(authenticate)` TODO exige un token válido.
 * Los roles se aplican así:
 *  - módulos solo para ADMIN: aquí, con `requireRole('ADMIN')` en el montaje (users, sales);
 *  - módulos mixtos: en su archivo `*.routes.ts`, ruta por ruta (ver la matriz en
 *    .claude/skills/fullstack-domain-reference/references/users-roles.md).
 * Una ruta nueva sin guardia de rol queda abierta a CUALQUIER usuario autenticado: decide su rol
 * al crearla y añádela a la matriz de tests/integration/auth-roles.test.ts.
 */

import { Router } from 'express';
import categoryRoutes from './category.routes';
import productRoutes from './product.routes';
import ingredientRoutes from './ingredient.routes';
import recipeRoutes from './recipe.routes';
import orderRoutes from './order.routes';
import saleRoutes from './sale.routes';
import inventoryRoutes from './inventory.routes';
import dashboardRoutes from './dashboard.routes';
import cajaRoutes from './caja.routes';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Montar submódulo de Autenticación en /api/auth (PÚBLICO: solo POST /auth/login)
router.use('/auth', authRoutes);

// ---- Desde aquí, todas las rutas exigen sesión (Authorization: Bearer <token>) ----
router.use(authenticate);

// Montar submódulo de Usuarios en /api/users (solo ADMIN)
router.use('/users', requireRole('ADMIN'), userRoutes);

// Montar submódulo de Categorías en /api/categories
router.use('/categories', categoryRoutes);

// Montar submódulo de Productos en /api/products
router.use('/products', productRoutes);

// Montar submódulo de Insumos en /api/ingredients
router.use('/ingredients', ingredientRoutes);

// Montar submódulo de Recetas en /api/recipes
router.use('/recipes', recipeRoutes);

// Montar submódulo de Comandas en /api/orders
router.use('/orders', orderRoutes);

// Montar submódulo de Ventas y Facturación en /api/sales (solo ADMIN: la UI no lo usa y expone todo el historial)
router.use('/sales', requireRole('ADMIN'), saleRoutes);

// Montar submódulo de Kardex y Alertas de Inventario en /api/inventory
router.use('/inventory', inventoryRoutes);

// Montar submódulo de Dashboard y KPIs en /api/dashboard
router.use('/dashboard', dashboardRoutes);

// Montar submódulo de Caja y Arqueo en /api/caja
router.use('/caja', cajaRoutes);

export default router;
