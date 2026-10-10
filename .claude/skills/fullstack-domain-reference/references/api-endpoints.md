# Catálogo de endpoints

Verificado contra `backend/src/routes/*.ts` y `controllers/*.ts`. **Actualiza este archivo cuando agregues o cambies un endpoint.**

## Contenido
- Convenciones generales
- Auth · Users · Categories · Products · Ingredients · Recipes · Orders · Sales · Inventory · Dashboard · Caja

## Convenciones generales

- Base: `{API}/api` (el frontend la arma con `getApiBaseUrl()`; `GET /health` está fuera de `/api`).
- JSON en ambos sentidos (`Content-Type: application/json`), salvo Excel (binario) y la importación (`multipart/form-data`, campo `file`).
- Éxito: objeto/array crudo. Borrados: `{ "message": "... correctamente" }`.
- Error: `{ "error": "mensaje en español" }` (+ `details` en 500). Códigos: 400 validación/regla de negocio/duplicado, 401 login, 403 usuario inactivo, 404 no encontrado, 500 inesperado.
- Ruta inexistente: 404 `{ "error": "Ruta o endpoint no encontrado" }`. Excepción no controlada: 500 `{ "error": "Error interno del servidor", "details": ... }`.
- **Sin autenticación** en ningún endpoint (ver `users-roles.md`).
- IDs de URL se convierten con `Number(...)` sin validar: un id no numérico produce 500 (no 400). Los endpoints nuevos deben validar con `Number.isInteger`.
- `req.body` es `undefined` si no llega JSON: un POST sin body produce 500 en los controllers actuales. Los nuevos usan `req.body ?? {}`.

## Health

`GET /health` -> `{ "status": "OK", "timestamp": "<ISO>" }`

## Auth - `/api/auth`

| Método y ruta | Body | Respuesta |
|---|---|---|
| `POST /login` | `{ username, password }` | 200 `{ user: { id, fullName, username, role, active, joinedAt } }` · 400 faltan campos · 401 credenciales (usuario **sensible a mayúsculas**) · 403 usuario inactivo |

## Users - `/api/users`

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | (el frontend envía `page`,`limit`; **se ignoran**) | array de usuarios sin `passwordHash`, orden por id |
| `GET /:id` | - | usuario · 404 |
| `POST /` | `{ fullName, username, password, role?, joinedAt? }` | 201 usuario · 400 (faltan datos / contraseña < 6 / usuario ya existe) |
| `PUT /:id` | `{ fullName?, username?, role?, active?, joinedAt? }` | usuario · 404 · 400 (usuario duplicado / último admin) |
| `PATCH /:id/password` | `{ password }` | `{ message }` · 400 · 404 |
| `PATCH /:id/status` | `{ active: boolean }` | usuario · 400 `CANNOT_DEACTIVATE_LAST_ADMIN` · 404 |

## Categories - `/api/categories`

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | array con `_count.products`, orden por nombre |
| `GET /:id` | - | categoría con `products` · 404 |
| `POST /` | `{ name, description? }` | 201 · 400 nombre vacío o duplicado |
| `PUT /:id` | `{ name?, description? }` | categoría · 404 |
| `DELETE /:id` | - | `{ message }` · 404 · **500 si tiene productos** (FK restrict) |

## Products - `/api/products`

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `categoryId?`, `available?` (`true`/`false`), `productType?` | array con `category` y `recipe.recipeDetails[].ingredient`, orden por nombre |
| `GET /:id` | - | producto con categoría y receta · 404 |
| `POST /` | `{ categoryId, name, salePrice, description?, image?, available?, productType?, recipe?: { name?, ingredients: [{ ingredientId, quantity, measurementUnit }] } }` | 201 · 400 si faltan `categoryId`/`name`/`salePrice` |
| `PUT /:id` | cualquier subconjunto de los campos del producto (la receta NO se edita aquí) | producto · 404 |
| `DELETE /:id` | - | `{ message }` · 404. **Borra también `order_details` y `sale_details` del producto** y su receta |

## Ingredients - `/api/ingredients`

Orden de rutas importante: las estáticas (`/template/...`, `/export/...`, `/import/...`) se registran **antes** de `/:id`.

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `search?` (nombre o descripción) | array, orden por nombre |
| `GET /template/ingredients` | - | `.xlsx` `plantilla_carga_ingredientes.xlsx` |
| `GET /export/ingredients` | - | `.xlsx` `reporte_inventario_ingredientes.xlsx` |
| `POST /import/ingredients` | multipart `file` | 200 `{ message, summary: { created, updated, skipped, errors: string[] } }` · 400 sin archivo / sin hojas |
| `GET /:id` | - | insumo + `inventoryMovements` (últimos 20) · 404 |
| `POST /` | `{ name, measurementUnit, description?, currentStock?, minimumStock?, unitCost? }` | 201 (si `currentStock > 0` crea movimiento `IN/PURCHASE` "Initial Stock") · 400 faltan/duplicado |
| `PUT /:id` | `{ name?, description?, measurementUnit?, minimumStock?, unitCost?, active?, adjustStock?, adjustReason? }` | insumo · 404 · 400 `STOCK_CANNOT_BE_NEGATIVE`. `adjustStock` es un **delta con signo**; `currentStock` no se edita directo |
| `DELETE /:id` | - | `{ message }` · borra sus movimientos y detalles de receta |

## Recipes - `/api/recipes`

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | recetas con `product` y `recipeDetails.ingredient` |
| `GET /product/:productId` | - | receta · 404 |
| `POST /` | `{ productId, name?, ingredients: [{ ingredientId, quantity, measurementUnit }] }` | 201; **crea o reemplaza** los detalles · 404 producto inexistente · 400 body inválido |
| `DELETE /:id` | - | `{ message }` · 404 |

## Orders - `/api/orders`

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `scope?` (`all`), `date?` (`YYYY-MM-DD`), `cashSessionId?`. Prioridad: `scope=all` > `date` > `cashSessionId` > por defecto solo `active=true` | array con `orderDetails.product`, `sale`, `cashSession{id,sessionNumber,openedAt}`; más recientes primero |
| `GET /:id` | - | comanda · 404 |
| `POST /` | `{ items: [{ productId, quantity, unitPrice?, notes? }], notes?, paymentMethod?, tax?, discount? }` | 201 `{ ...order, sale }` (crea comanda + venta y descuenta insumos). 400: sin items · `CAJA_CERRADA` · `PRODUCT_NOT_FOUND:<id>` · `PRODUCT_UNAVAILABLE:<nombre>` |
| `DELETE /:id` | - | `{ message }` · borra la venta asociada y la comanda; **no devuelve stock** |

## Sales - `/api/sales`

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | ventas con `order` y `saleDetails.product` |
| `GET /:id` | - | venta · 404 |
| `POST /` | `{ orderId? \| items: [{ productId, quantity, unitPrice? }], paymentMethod?, tax?, discount? }` | 201 · 404 `ORDER_NOT_FOUND` · 400 `INVALID_PAYLOAD` o comanda ya facturada. No descuenta stock ni exige caja |

## Inventory - `/api/inventory`

| Método y ruta | Query | Respuesta |
|---|---|---|
| `GET /movements` | `ingredientId?`, `type?`, `reason?` | **todos** los movimientos que coincidan (sin paginar) con `ingredient`, más recientes primero |
| `GET /alerts` | - | insumos activos con `currentStock <= minimumStock` |

## Dashboard - `/api/dashboard`

`GET /kpis?period=day|month|year` (otro valor = `day`) ->

```json
{
  "period": "day",
  "totalRevenue": 20.22,
  "totalItemsSold": 3,
  "grossProfit": 14.51,
  "stockAlertsCount": 2,
  "topSellingProducts": [{ "id": 1, "name": "Hamburguesa con Queso", "totalSold": 2 }],
  "criticalStockIngredients": [{ "id": 1, "name": "Carne", "currentStock": 2, "minimumStock": 10, "measurementUnit": "unidad", "percentageRemaining": 20 }]
}
```

Ingresos = suma de `Sale.total` desde el inicio del periodo; ganancia = ingresos - costo de receta (`quantity * unitCost`) de lo vendido.

## Caja - `/api/caja`

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /status` | - | abierta: `{ isOpen: true, activeSession: {...} }`; cerrada: `{ isOpen: false, activeSession: null, lastClosedSession: {...} \| null }` |
| `POST /open` | `{ denominations, notes?, userId? }` | 201 sesión · 400 sin `denominations` · 400 `SESSION_ALREADY_OPEN` |
| `POST /close` | `{ denominations, closingNotes?, userId? }` | 200 sesión cerrada (`CLOSED` o `LATE_CLOSED`) · 400 `NO_ACTIVE_SESSION` |
| `PUT /:id` | `{ initialAmount?, finalAmount?, notes?, closingNotes? }` | sesión · 404 (edición administrativa; no cambia el desglose) |
| `GET /history` | `limit?` (20), `page?` (1), `openedByUserId?` | `{ total, page, limit, totalPages, sessions[] }` |
| `GET /session/:id` | - | sesión con desgloses parseados · 404 |

`denominations`: objeto `{ "0.05": 10, "1": 30 }` o arreglo `[{ value, count }]`. Detalle de reglas en `cash-register.md`.
