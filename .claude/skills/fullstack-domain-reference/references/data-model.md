# Modelo de datos

Fuente de verdad de tipos: `backend/prisma/schema.prisma`. Fuente de verdad del **esquema físico**: las migraciones de `backend/src/prisma/init.ts` (ver skill `backend-db-migration`). Deben coincidir; el script `fullstack-verify-changes/scripts/preflight.mjs` avisa si no.

## Contenido
- Convenciones del esquema
- Modelos y relaciones
- Enums
- Diagrama de relaciones
- Datos serializados como JSON

## Convenciones del esquema

- Campos en `camelCase` con `@map("snake_case")`; tablas en plural `snake_case` con `@@map`.
- `id Int @id @default(autoincrement())`; `createdAt @default(now())` y `updatedAt @updatedAt` (con `@map("created_at")` / `@map("updated_at")`).
- Enums de Prisma se guardan como `TEXT`. `User.role` es `String` ("ADMIN" | "WORKER"), no enum.
- Dinero y cantidades: `Float`. Redondea dinero con `Number(x.toFixed(2))`.
- Booleanos: `BOOLEAN` (0/1).
- Relaciones: `onDelete: Cascade` solo donde se indica; el resto es `Restrict` (borrar el padre falla con `P2003` si hay hijos).

## Modelos

| Modelo (tabla) | Campos clave | Relaciones / notas |
|---|---|---|
| `User` (`users`) | `fullName`, `username` (único, **sensible a mayúsculas**), `passwordHash` (`salt:hash` scrypt), `role`, `active`, `joinedAt` | `openedSessions` / `closedSessions` -> `CashSession` |
| `Category` (`categories`) | `name` (único), `description?` | 1-N `Product` (restrict) |
| `Product` (`products`) | `categoryId`, `name` (no único), `description?`, `salePrice`, `image?`, `available`, `productType` | `category`, `recipe?` (1-1), `orderDetails`, `saleDetails`. Índices: `categoryId`, `available` |
| `Ingredient` (`ingredients`) | `name` (único), `description?`, `measurementUnit` (texto libre), `currentStock`, `minimumStock`, `unitCost`, `active` | `recipeDetails`, `inventoryMovements` |
| `Recipe` (`recipes`) | `productId` (único), `name` | `product` (**cascade**), `recipeDetails` |
| `RecipeDetail` (`recipe_details`) | `recipeId`, `ingredientId`, `quantity`, `measurementUnit` | `recipe` (**cascade**), `ingredient`; único `(recipeId, ingredientId)` |
| `Order` (`orders`) | `number` (único, `ORD-0001`), `notes?`, `date`, `total`, `active`, `cashSessionId?` | `orderDetails`, `sale?` (1-1), `cashSession?`. Índices: `active`, `cashSessionId` |
| `OrderDetail` (`order_details`) | `orderId`, `productId`, `quantity` (Int), `unitPrice`, `subtotal`, `notes?` | `order` (**cascade**), `product` |
| `Sale` (`sales`) | `invoiceNumber` (único, `INV-2026-0001`), `orderId?` (único), `subtotal`, `tax`, `discount`, `total`, `paymentMethod`, `fecha` | `order?`, `saleDetails` |
| `SaleDetail` (`sale_details`) | `saleId`, `productId`, `quantity`, `unitPrice`, `subtotal` | `sale` (**cascade**), `product` |
| `InventoryMovement` (`inventory_movements`) | `ingredientId`, `type`, `reason`, `quantity`, `previousStock`, `newStock`, `reference?`, `date` | `ingredient`. Índices: `ingredientId`, `date`. **Append-only**: no se edita |
| `CashSession` (`cash_sessions`) | `sessionNumber` (único, `CAJA-2026-0001`), `status`, `openedAt`, `closedAt?`, `initialAmount`, `initialDenominations` (JSON), `finalAmount?`, `finalDenominations?` (JSON), `notes?`, `closingNotes?`, `openedByUserId?`, `closedByUserId?` | `openedByUser?`, `closedByUser?`, `orders` |

## Enums

| Enum | Valores |
|---|---|
| `ProductType` | `PREPARED` (consume receta) · `DIRECT_INVENTORY` (venta directa, sin receta ni control de stock) |
| `PaymentMethod` | `CASH` · `CARD` · `TRANSFER` · `MIXED` |
| `MovementType` | `IN` · `OUT` · `ADJUSTMENT` (el backend actual solo genera IN/OUT) |
| `MovementReason` | `PURCHASE` · `SALE` · `WASTE` · `MANUAL_ADJUSTMENT` |
| `CashSessionStatus` | `OPEN` · `CLOSED` · `LATE_CLOSED` (cerrada otro día calendario) |

Al agregar un valor a un enum hay que actualizar también los mapas de etiquetas/badges del frontend (p. ej. `REASON_LABELS`, `PRODUCT_TYPES`, estados de caja).

## Diagrama de relaciones

```
Category 1─N Product 1─1 Recipe 1─N RecipeDetail N─1 Ingredient 1─N InventoryMovement
                │                                      
                ├─N OrderDetail N─1 Order 1─1? Sale 1─N SaleDetail N─1 Product
                │                      │
                │                      └─N─1? CashSession N─1? User (opened/closed by)
                └─N SaleDetail
```

## Datos serializados como JSON

`CashSession.initialDenominations` y `finalDenominations` son **strings JSON** (`{"0.05": 10, "1": 30}`). Se guardan con `JSON.stringify` y se parsean en el service (con `try/catch`) antes de responder; el frontend siempre recibe objetos. Usa este mismo patrón si un campo necesita estructura libre (SQLite no tiene tipo JSON en este setup).
