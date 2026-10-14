# Catálogo de endpoints

Verificado contra `backend/src/routes/*.ts` y `controllers/*.ts` (2026-10-13). **Actualiza este archivo cuando agregues o cambies un endpoint.** La matriz de roles ejecutable (la que vigilan las pruebas) es `backend/tests/helpers/roleMatrix.ts`; el resumen legible está en `users-roles.md`.

## Contenido
- Convenciones generales (autenticación, errores, validación)
- Auth · Users · Categories · Products · Ingredients · Recipes · Orders · Sales · Inventory · Dashboard · Caja

## Convenciones generales

- Base: `{API}/api` (el frontend la arma con `getApiBaseUrl()`; `GET /health` está fuera de `/api`).
- **Autenticación**: todo `/api` salvo `POST /api/auth/login` exige `Authorization: Bearer <token>` (el token lo devuelve el login). `/health`, el SPA estático y el preflight CORS (`OPTIONS`) son públicos. Una ruta inexistente de `/api` **sin token** responde 401 (no 404). Las descargas (Excel) también necesitan la cabecera: no se pueden abrir con un enlace directo.
- **Roles**: `ADMIN` y `WORKER` (= cualquier usuario autenticado salvo lo marcado). Cada módulo indica abajo su regla; sin permiso -> 403.
- JSON en ambos sentidos (`Content-Type: application/json`, cuerpo máx. **100 kb**), salvo Excel (binario) y la importación (`multipart/form-data`, campo `file`).
- Éxito: objeto/array crudo. Borrados: `{ "message": "... correctamente" }`.
- Error: `{ "error": "mensaje en español" }`; en los 500 se añade `details` **siempre como texto** (los errores de Prisma se sustituyen por un texto genérico y el detalle va solo al log). Códigos:

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | validación, regla de negocio, duplicado, id inválido, JSON inválido | `{ error }` (`ID inválido`, `JSON inválido`...) |
| 401 | falta el token, es inválido/vencido, o el usuario ya no existe/está inactivo/cambió su contraseña | `{ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.', code }` con `code` = `NO_TOKEN` · `INVALID_TOKEN` · `TOKEN_EXPIRED` · `USER_INACTIVE`, y cabecera `WWW-Authenticate: Bearer`. El **login** también responde 401, pero sin `code` (credenciales incorrectas) |
| 403 | autenticado pero sin permiso para esa acción (rol o turno); en el login, usuario inactivo | `{ error: 'No tienes permisos para realizar esta acción.' }` (el login: texto propio, sin `code`) |
| 404 | recurso no encontrado | `{ error }` |
| 413 | cuerpo mayor de 100 kb | `{ error: 'El cuerpo de la petición supera el tamaño máximo permitido' }` |
| 429 | límite de tasa (login: 10 intentos **fallidos** por IP / 15 min; `/api`: 600 peticiones por IP / min) | `{ error }` en español + cabeceras `Retry-After` y `RateLimit-*` |
| 500 | inesperado | `{ error, details: "texto" }` |

- Ruta inexistente con sesión: 404 `{ "error": "Ruta o endpoint no encontrado" }`. Excepción no controlada: 500 `{ "error": "Error interno del servidor", "details": "texto" }`.
- **Ids de URL** (`:id`, `:productId`): se validan con `router.param` + `validateIdParam`; un id que no sea entero positivo responde 400 `{ error: 'ID inválido' }` (nunca 500). Los filtros de query inválidos (`ingredientId`, `categoryId`, `cashSessionId`, `openedByUserId`, `type`, `reason`, `productType`, `date`, `page`, `limit`) también responden 400.
- **Cuerpo**: `ensureBody` deja `req.body = {}` si no llega JSON (un POST vacío responde 400 por validación, no 500); JSON malformado -> 400 `{ error: 'JSON inválido' }`. Los controllers leen `req.body ?? {}`.
- **Textos opcionales** (`description`, `image`, notas): `undefined` = no tocar; `null` o `''` = limpiar (se guarda `null`); otro tipo = 400. **Nombres** obligatorios: un texto en blanco o que no sea texto -> 400 (categorías, productos, insumos, usuarios, recetas).
- **Paginación de servidor** (opcional): si no envías `page` ni `limit`, el endpoint devuelve la lista completa; con alguno devuelve `{ total, page, limit, totalPages, <items> }`. `page`/`limit` inválidos -> 400; un `limit` mayor que el máximo se recorta.

## Health

`GET /health` -> `{ "status": "OK", "timestamp": "<ISO>" }` (público, fuera del límite de tasa).

## Auth - `/api/auth`

| Método y ruta | Body | Respuesta |
|---|---|---|
| `POST /login` (**pública**) | `{ username, password }` (el usuario **no distingue mayúsculas**) | 200 `{ user: { id, fullName, username, role, active, joinedAt }, token }` (con `Cache-Control: no-store`) · 400 faltan campos · 401 credenciales (sin `code`) · 403 usuario inactivo · 429 demasiados intentos fallidos |
| `GET /me` (token) | - | 200 `{ user }` leído de la BD ahora mismo (rol y estado frescos) · 401 con `code` |

Token: JWT HS256 con `sub` (id), `role` (informativo), `pv` (huella del hash de la contraseña) y vigencia `JWT_EXPIRES_IN` (12 h por defecto). Se envía como `Authorization: Bearer <token>`. El servidor relee al usuario en cada petición: desactivarlo -> 401 inmediato; cambiar su rol aplica ya; cambiar su contraseña invalida sus tokens anteriores. No hay renovación ni logout de servidor.

## Users - `/api/users` (solo ADMIN)

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `page?`, `limit?` (15 por defecto, máx. 100) | sin parámetros: array de usuarios sin `passwordHash`, orden por id. Con alguno: `{ total, page, limit, totalPages, users }` |
| `GET /:id` | - | usuario · 404 |
| `POST /` | `{ fullName, username, password, role?, joinedAt? }` | 201 usuario · 400 (faltan datos / contraseña < 6 / usuario ya existe sin distinguir mayúsculas / fecha inválida) |
| `PUT /:id` | `{ fullName?, username?, role?, active?, joinedAt? }` | usuario · 404 · 400 (usuario duplicado / `active` no booleano / último admin) |
| `PATCH /:id/password` | `{ password }` | `{ message }` · 400 · 404. Invalida los tokens anteriores del usuario (también el del admin que cambia la suya) |
| `PATCH /:id/status` | `{ active: boolean }` | usuario · 400 `CANNOT_DEACTIVATE_LAST_ADMIN` · 404 |

## Categories - `/api/categories`

Leer: todos. Crear, editar, borrar: solo ADMIN.

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | array con `_count.products`, orden por nombre |
| `GET /:id` | - | categoría con `products` · 404 |
| `POST /` | `{ name, description? }` | 201 · 400 nombre vacío/en blanco o duplicado |
| `PUT /:id` | `{ name?, description? }` | categoría · 404 · 400 (nombre en blanco, duplicado). `description: null` la limpia |
| `DELETE /:id` | - | `{ message }` · 404 · **400 si tiene productos** (con la cuenta: "tiene N productos asociados") |

## Products - `/api/products`

Leer: todos. Crear y borrar: solo ADMIN. `PUT`: ADMIN cualquier campo; **WORKER solo si el cuerpo trae únicamente `available`** (marcar agotado/disponible), si no 403.

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `categoryId?`, `available?` (`true`/`false`), `productType?` | array con `category` y `recipe.recipeDetails[].ingredient`, orden por nombre · 400 filtros inválidos |
| `GET /:id` | - | producto con categoría y receta · 404 |
| `POST /` | `{ categoryId, name, salePrice, description?, image?, available? (boolean), productType?, recipe?: { name?, ingredients: [{ ingredientId, quantity, measurementUnit? }] } }` | 201 · 400 (faltan `categoryId`/`name`/`salePrice`, precio negativo, categoría o insumo inexistente, receta inválida) |
| `PUT /:id` | cualquier subconjunto de los campos del producto (la receta NO se edita aquí: `POST /api/recipes`). `description: null` y `image: null` limpian el campo | producto · 404 · 400 |
| `DELETE /:id` | - | `{ message }` (borra también su receta) · 404 · **400 si tiene líneas de comanda o venta**: "desactívalo en lugar de eliminarlo" (`PUT` con `available: false`) |

## Ingredients - `/api/ingredients`

Leer y descargar plantilla/reporte: todos. Crear, borrar e importar: solo ADMIN. `PUT`: ADMIN cualquier campo; **WORKER solo `adjustStock` y/o `adjustReason`** (ajuste de stock), si no 403.

Orden de rutas importante: las estáticas (`/template/...`, `/export/...`, `/import/...`) se registran **antes** de `/:id`.

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `search?` (nombre o descripción) | array, orden por nombre |
| `GET /template/ingredients` | - | `.xlsx` `plantilla_carga_ingredientes.xlsx` |
| `GET /export/ingredients` | - | `.xlsx` `reporte_inventario_ingredientes.xlsx` |
| `POST /import/ingredients` | multipart `file`: solo `.xlsx` (máx. 10 MB y 5000 filas, columnas de la plantilla oficial) | 200 `{ message, summary: { created, updated, skipped, errors: string[] } }` con el resumen **final** (se procesan todas las filas antes de responder; una fila con error va a `errors` y no aborta el lote; reglas en `inventory-kardex.md`) · 400 `{ error }`: sin archivo, no es `.xlsx`, > 10 MB, archivo inválido, sin hojas, plantilla distinta, > 5000 filas |
| `GET /:id` | - | insumo + `inventoryMovements` (últimos 20) · 404 |
| `POST /` | `{ name, measurementUnit, description?, currentStock?, minimumStock?, unitCost? }` | 201 (si `currentStock > 0` crea movimiento `IN/PURCHASE` "Initial Stock", en la misma transacción) · 400 faltan/en blanco/duplicado/números negativos |
| `PUT /:id` | `{ name?, description?, measurementUnit?, minimumStock?, unitCost?, active?, adjustStock?, adjustReason? }` | insumo · 404 · 400 `STOCK_CANNOT_BE_NEGATIVE`, nombre/unidad en blanco, `adjustStock` no numérico, **`adjustReason` fuera de `PURCHASE\|SALE\|WASTE\|MANUAL_ADJUSTMENT`**. `adjustStock` es un **delta con signo** y se aplica con su movimiento en una transacción; `currentStock` no se edita directo. `description: null` la limpia |
| `DELETE /:id` | - | `{ message }` · 404 · borra sus movimientos y detalles de receta |

## Recipes - `/api/recipes`

Leer: todos. Guardar y borrar: solo ADMIN.

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | recetas con `product` y `recipeDetails.ingredient` |
| `GET /product/:productId` | - | receta · 404 |
| `POST /` | `{ productId, name?, ingredients: [{ ingredientId, quantity, measurementUnit? }] }` | 201; **upsert atómico**: crea la receta o **reemplaza por completo** la lista de insumos (una lista vacía deja la receta sin insumos) · 404 producto inexistente · 400 body inválido, cantidades <= 0, insumo repetido o inexistente |
| `DELETE /:id` | - | `{ message }` · 404 |

## Orders - `/api/orders`

`POST` y lecturas: todos, pero el **WORKER solo ve y borra las comandas del turno actual**; el ADMIN accede a todo.

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /` | `scope?` (`all`), `date?` (`YYYY-MM-DD`), `cashSessionId?`. Prioridad: `scope=all` > `date` > `cashSessionId` > por defecto solo `active=true` | array con `orderDetails.product`, `sale`, `cashSession{id,sessionNumber,openedAt}`; más recientes primero. 400 fecha o `cashSessionId` inválidos. **WORKER**: `scope=all`, cualquier `date` o un `cashSessionId` distinto de la caja abierta -> 403 |
| `GET /:id` | - | comanda · 404. **WORKER**: solo si la comanda sigue activa (turno actual), si no 403 |
| `POST /` | `{ items: [{ productId, quantity, unitPrice?, notes? }], notes?, paymentMethod?, tax?, discount? }` | 201 `{ ...order, sale }` (crea comanda + venta y descuenta insumos, todo en una transacción). 400: sin items · `CAJA_CERRADA` · `PRODUCT_NOT_FOUND:<id>` · `PRODUCT_UNAVAILABLE:<nombre>` · cantidad no entera > 0 (`INVALID_ITEM`) · impuesto/descuento inválidos · forma de pago inválida · **stock insuficiente**: `{ error, shortages: [{ ingredientId, name, measurementUnit, needed, available }] }` (no se crea ni descuenta nada) |
| `DELETE /:id` | - | `{ message }` · 404 · borra la venta asociada y la comanda **y devuelve el stock** de los insumos consumidos con movimientos `IN` `MANUAL_ADJUSTMENT` y referencia `Anulación Order #ORD-xxxx` (misma transacción; también si la comanda está archivada). **WORKER**: solo comandas del turno actual, si no 403 |

## Sales - `/api/sales` (solo ADMIN: la UI no lo usa y expone todo el historial)

| Método y ruta | Body | Respuesta |
|---|---|---|
| `GET /` | - | ventas con `order` y `saleDetails.product` |
| `GET /:id` | - | venta · 404 |
| `POST /` | `{ orderId? \| items: [{ productId, quantity, unitPrice? }], paymentMethod?, tax?, discount? }` | 201 · 404 `ORDER_NOT_FOUND` · 400 `INVALID_PAYLOAD`, ítems/importes/forma de pago inválidos o comanda ya facturada. No descuenta stock ni exige caja |

## Inventory - `/api/inventory` (lectura para todos)

| Método y ruta | Query | Respuesta |
|---|---|---|
| `GET /movements` | `ingredientId?`, `type?`, `reason?`, `page?`, `limit?` (50 por defecto, máx. 500) | con `ingredient`, más recientes primero. Sin `page`/`limit`: **todos** los que coincidan (array). Con alguno: `{ total, page, limit, totalPages, movements }`. 400 filtros inválidos |
| `GET /alerts` | - | insumos activos con `currentStock <= minimumStock` |

## Dashboard - `/api/dashboard` (lectura para todos)

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

Todos abren, cierran y consultan; `PUT /:id` (edición administrativa) solo ADMIN. **Quién abre o cierra sale del token** (`req.user.id`): el `userId` del cuerpo, si llega, se ignora.

| Método y ruta | Body / query | Respuesta |
|---|---|---|
| `GET /status` | - | abierta: `{ isOpen: true, activeSession: {...} }`; cerrada: `{ isOpen: false, activeSession: null, lastClosedSession: {...} \| null }` |
| `POST /open` | `{ denominations, notes? }` | 201 sesión · 400 sin `denominations` · 400 `SESSION_ALREADY_OPEN` |
| `POST /close` | `{ denominations, closingNotes? }` | 200 sesión cerrada (`CLOSED` o `LATE_CLOSED`) · 400 `NO_ACTIVE_SESSION` |
| `PUT /:id` | `{ initialAmount?, finalAmount?, notes?, closingNotes? }` | sesión · 404 · 400 importes negativos o notas que no son texto (edición administrativa; no cambia el desglose) |
| `GET /history` | `limit?` (20, máx. 200), `page?` (1), `openedByUserId?` | `{ total, page, limit, totalPages, sessions[] }` · 400 parámetros inválidos |
| `GET /session/:id` | - | sesión con desgloses parseados · 404 |

`denominations`: objeto `{ "0.05": 10, "1": 30 }` o arreglo `[{ value, count }]`. Detalle de reglas en `cash-register.md`.
