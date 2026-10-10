# Inventario, recetas y Kardex

Código: `backend/src/services/ingredient.service.ts`, `inventory.service.ts`, `recipe.service.ts`, `product.service.ts`; frontend `frontend/src/app/inventory/` y `products/`.

## Contenido
- Conceptos
- Regla de oro del Kardex
- Tipos y motivos de movimiento
- Ajustes manuales
- Consumo por ventas
- Alertas de stock bajo
- Excel (plantilla, reporte, importación)
- Frontend

## Conceptos

- **Ingredient (insumo)**: materia prima con `currentStock`, `minimumStock` (umbral de alerta), `unitCost`, `measurementUnit` (texto libre; la UI ofrece unidad, kg, g, litro, ml, porcion) y `active`.
- **Recipe / RecipeDetail**: receta 1-1 con un producto `PREPARED`; cada detalle = `quantity` de un insumo por unidad vendida. La unidad de la receta es **informativa**: no hay conversión de unidades.
- **Producto `DIRECT_INVENTORY`**: no tiene receta ni stock propio; vender uno **no descuenta nada**.
- **InventoryMovement (Kardex)**: bitácora de cambios de stock. Es **append-only** (solo se borra al eliminar el insumo).

## Regla de oro del Kardex

Todo cambio de `Ingredient.currentStock` debe crear un `InventoryMovement` con `previousStock` y `newStock` correctos, en la **misma transacción** que el cambio. Si no, el Kardex deja de cuadrar con el stock. Receta en `backend-transactions-kardex`.

## Tipos y motivos de movimiento

| Situación | `type` | `reason` | `reference` usada |
|---|---|---|---|
| Insumo creado con stock inicial > 0 | `IN` | `PURCHASE` | `Initial Stock` |
| Ajuste manual positivo | `IN` | el elegido (`PURCHASE`/`MANUAL_ADJUSTMENT`...) | `Manual Adjustment` |
| Ajuste manual negativo / merma | `OUT` | `WASTE` o `MANUAL_ADJUSTMENT` | `Manual Adjustment` |
| Venta de producto con receta | `OUT` | `SALE` | `Order #ORD-0001` |
| Importación masiva (insumo nuevo con stock) | `IN` | `PURCHASE` | `Bulk Excel Import` |

`ADJUSTMENT` existe en el enum pero el backend actual nunca lo emite (usa `IN`/`OUT` según el signo).

## Ajustes manuales

`PUT /api/ingredients/:id` con `adjustStock` (delta **con signo**) y `adjustReason`:
- nuevo stock = actual + delta; si queda < 0 -> `STOCK_CANNOT_BE_NEGATIVE` (400);
- crea el movimiento y actualiza el insumo (hoy en llamadas separadas, no en transacción; mejóralo si tocas ese código).

La UI (`StockAdjustmentModal`) convierte el motivo en signo: `PURCHASE` = `+abs`, `WASTE` = `-abs`, `MANUAL_ADJUSTMENT` = el valor tal cual; calcula el "stock proyectado" y también envía `unitCost` (el backend lo **sobrescribe**, no promedia).

## Consumo por ventas

`OrderService.createOrder`: por cada línea con receta, descuenta `detail.quantity * qty` de cada insumo y registra `OUT/SALE`. **No valida stock suficiente** (puede quedar negativo). `deleteOrder` **no devuelve** el stock. Si implementas devoluciones, crea movimientos compensatorios `IN` (no borres movimientos).

## Alertas de stock bajo

Regla única: `active && currentStock <= minimumStock` (en `InventoryService.getLowStockAlerts` y en `DashboardService`). Porcentaje restante del dashboard: `round(current / minimum * 100)`; con mínimo 0 -> 0 si no hay stock, 100 si hay. La UI (`getStockStatus`): `<= 0` Agotado, `<= mínimo` Stock Bajo, resto Óptimo.

## Excel (plantilla, reporte, importación)

Columnas de la plantilla/importación (orden fijo): Nombre (*), Descripción, Unidad de Medida (*), Stock Inicial, Stock Mínimo, Costo Unitario. Importación: upsert por **nombre**; existente -> actualiza campos (**incluido `currentStock` sin crear movimiento**); nuevo -> crea y, si hay stock, movimiento `Bulk Excel Import`. Detalles y bug conocido de la implementación actual: skill `backend-excel-import-export` y `known-issues.md`.

## Frontend

| Archivo | Rol |
|---|---|
| `InventoryPage.jsx` | carga insumos + alertas, filtro `Todos` / `Stock Bajo` (también por `?tab=alerts`), búsqueda, paginación en cliente (15) |
| `IngredientTable.jsx` | tabla con acciones: ajustar stock y ver Kardex (todos los roles); editar y eliminar (solo admin) |
| `IngredientModal.jsx` | crear/editar; en edición el stock actual está deshabilitado ("usa Ajustar Stock") |
| `StockAdjustmentModal.jsx` | movimiento de Kardex con proyección |
| `KardexModal.jsx` | movimientos de un insumo (`GET /ingredients/:id`) o globales (`GET /inventory/movements`) |
| `BulkImportModal.jsx` + header | plantilla, exportar e importar (importar solo admin) |

En productos, la receta solo se define al **crear** el producto desde la UI (la edición no la envía).
