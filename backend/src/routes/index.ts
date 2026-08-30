/**
 * ====================================================
 * ENRUTADOR CENTRAL / MASTER ROUTER
 * ====================================================
 * Agrupa y monta los submódulos de rutas bajo el prefijo `/api`.
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

const router = Router();

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

// Montar submódulo de Ventas y Facturación en /api/sales
router.use('/sales', saleRoutes);

// Montar submódulo de Kardex y Alertas de Inventario en /api/inventory
router.use('/inventory', inventoryRoutes);

// Montar submódulo de Dashboard y KPIs en /api/dashboard
router.use('/dashboard', dashboardRoutes);

// Montar submódulo de Caja y Arqueo en /api/caja
router.use('/caja', cajaRoutes);

export default router;
