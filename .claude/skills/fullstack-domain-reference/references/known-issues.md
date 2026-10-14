# Problemas conocidos y legado (no los copies)

Auditoría del 2026-10-09; estado actualizado el **2026-10-13**, tras la remediación coordinada (commits `5bf06d4` a `1ec6130`). Cada punto abierto se comprobó leyendo el código. **Antes de apoyarte en uno, vuelve a comprobar que sigue igual**: el código cambia. Úsalo para dos cosas: (1) no replicar estos patrones en código nuevo, (2) avisar al usuario cuando una tarea toque estas zonas. No los arregles "de paso" en un cambio ajeno; propónlos como tarea aparte.

Reglas de mantenimiento: al corregir un punto **bórralo de la tabla** (no lo tachas) y, si merece memoria, añade una línea a "Resueltos" con su control o prueba. Los identificadores `S`/`B`/`I`/`T` de este archivo vienen de la auditoría; **los `T1`/`T2` de esta lista (hallazgos de pruebas de bugs: nombre de categoría en blanco y `adjustReason` inválido) no son los T1..T4 de `SECURITY_TEST_REPORT.md`** (fuerza bruta, SQL, confirmaciones, carga).

## Contenido
- Seguridad y sesión
- Recomendaciones sobre el rol WORKER
- Bugs de funcionamiento
- Inconsistencias entre capas
- Duplicación y legado menor
- Operación
- Resueltos el 2026-10-13

## Seguridad y sesión

El servidor ya autentica y autoriza (JWT + roles; ver `users-roles.md`). Lo que sigue abierto:

| # | Problema | Dónde | Cómo actuar |
|---|---|---|---|
| S6 | Token en `sessionStorage`: legible por cualquier XSS. No hay renovación del token ni logout de servidor (cerrar sesión solo borra el token del navegador; un token robado vale hasta que vence o hasta que se desactive al usuario o cambie su contraseña). Vigencia por defecto 12 h (`JWT_EXPIRES_IN`) | `frontend/src/app/auth/authStorage.js`, `backend/src/utils/jwt.utils.ts` | La CSP en modo enforcing mitiga el XSS. Alternativas: cookie `httpOnly` + `SameSite` (exige protección CSRF) o vigencia de 8 h con renovación deslizante. Es una decisión de producto: propónla, no la cambies de paso |
| S7 | El login solo se limita **por IP** (10 intentos fallidos / 15 min), no por usuario: quien comparte IP con otro (todas las tablets del local) comparte cupo, y un atacante con muchas IP no se frena. Además revela por tiempo si el usuario existe (`scrypt` solo se calcula cuando el usuario existe: `auth.service.ts#login`) | `middleware/rateLimit.ts`, `services/auth.service.ts` | Aceptable en un POS de un local. Si se expone a internet: límite por usuario y hash ficticio para igualar tiempos |
| S8 | En una BD nueva fuera de producción el `Admin` se crea con `123456` (las pruebas dependen de ello). En producción ya no: usa `ADMIN_INITIAL_PASSWORD` o una aleatoria impresa una vez | `prisma/init.ts#resolveAdminInitialPassword` | Un despliegue sin `NODE_ENV=production` sobre una BD vacía vuelve a sembrar `123456`: el servidor avisa si detecta Railway/Render sin ella |
| S9 | El admin que cambia **su propia** contraseña pierde su sesión en la siguiente petición (el token lleva la huella `pv` de la contraseña vieja y no se devuelve un token nuevo): la UI lo manda al login con el aviso de sesión expirada | `PATCH /api/users/:id/password`, `middleware/auth.middleware.ts` | Es coherente con "cambiar la contraseña invalida los tokens"; si molesta, devolver un token nuevo en esa respuesta |

## Recomendaciones sobre el rol WORKER

No están restringidas **a propósito**, porque la UI se las ofrece al trabajador (restringirlas rompería el flujo de caja). Son decisiones de negocio, no bugs; confírmalas con el usuario antes de tocarlas.

| # | Riesgo | Dónde | Posible control |
|---|---|---|---|
| R1 | Un WORKER puede fijar el **precio unitario** de cada línea de una comanda (`items[].unitPrice`), y también `tax` y `discount` (mayor riesgo de fraude: un descuento enorme deja la venta en 0) | `order.service.ts#createOrder` | Ignorar `unitPrice`/`discount` para WORKER o exigir ADMIN; validar un tope |
| R2 | Un WORKER puede **borrar comandas del turno actual** sin rastro: `Order` no guarda quién la creó ni quién la borró (el stock vuelve al Kardex, pero la venta desaparece) | `order.service.ts#deleteOrder`, modelo `Order` | Guardar usuario creador/anulador o hacer baja lógica con motivo (cambio de esquema) |
| R3 | Los ajustes de stock del WORKER (`PUT /api/ingredients/:id` con `adjustStock`) quedan en el Kardex **sin usuario**: `InventoryMovement` no tiene autor | `ingredient.service.ts#updateIngredient`, modelo `InventoryMovement` | Añadir `userId` al movimiento (cambio de esquema) |
| R4 | El WORKER ve **todo el historial de caja** (`GET /api/caja/history`, `/session/:id`) y los **ingresos y la ganancia** del dashboard (`GET /api/dashboard/kpis`) | `caja.routes.ts`, `dashboard.routes.ts` | Limitar al turno actual (como `GET /api/orders`) u ocultar los importes al WORKER |

## Bugs de funcionamiento

| # | Problema | Dónde | Cómo actuar |
|---|---|---|---|
| B7 | **Resto de B7**: los productos `DIRECT_INVENTORY` no tienen stock ni receta y vender uno **no descuenta nada** (validar stock y devolverlo al borrar la comanda ya funciona para los productos con receta) | `order.service.ts#createOrder`, `schema.prisma` | Requiere cambio de esquema (stock propio del producto o receta obligatoria); decidir con el usuario |
| B9 | **Resto de B9**: la unicidad de `username` sin distinguir mayúsculas se comprueba en JS (`utils/username.utils.ts`), pero el índice único de la BD (`users_username_key`) **sí** distingue mayúsculas: dos altas simultáneas con variantes (`Ana` y `ana`) podrían colarse | `user.service.ts`, `prisma/init.ts` | Migración con un índice único sobre `lower(username)` (hay que limpiar duplicados antes) |

## Inconsistencias entre capas

| # | Problema | Cómo actuar |
|---|---|---|
| I1 | **Resto de I1**: `GET /api/users?page&limit` ya pagina en el servidor y la UI lo usa, pero el buscador de `UsersPage` solo filtra la **página cargada** (no hay búsqueda global) | Añadir `?search=` al backend y enviarlo desde `fetchUsers` cuando los usuarios superen una página |
| I2 | **Resto de I2**: `GET /api/inventory/movements?page&limit` ya existe (`{ total, page, limit, totalPages, movements }`), pero `KardexModal` no lo usa: sigue pidiendo todos los movimientos y paginando en cliente (15 por página) | Cuando crezca el Kardex, pasar el modal a paginación de servidor |
| I7 | Mensajes de error de dominio se identifican por texto (`error.message === 'CODIGO'`) | Mantener la convención en código nuevo; no mezclar con clases de error propias |
| I8 | `frontend/index.html` no tiene `<meta name="viewport" content="width=device-width, initial-scale=1.0">` (en teléfonos/tablets el sitio se renderiza a 980 px y los breakpoints no aplican); el `Sidebar` es fijo de 16 rem sin versión móvil | La app es de tablet/escritorio; soportar móvil es un cambio global aparte (decisión de producto) |

## Duplicación y legado menor

- Bloques de error/skeleton repetidos en cada página (la receta está en `frontend-design-system`; no hay componente común).
- Comentarios de código desactualizados: la cabecera de `backend/src/routes/index.ts` manda a añadir las rutas a la matriz de `tests/integration/auth-roles.test.ts` (la matriz vive en `backend/tests/helpers/roleMatrix.ts`) y un comentario de `UsersPage.jsx` aún dice que `GET /api/users` ignora `page/limit`.
- El frontend sigue enviando `userId` al abrir/cerrar caja (`OpenCajaModal`, `CloseCajaModal`, `CajaPage`): el servidor lo ignora y usa el del token. Es inofensivo; quítalo si tocas esos archivos.

## Operación

- Un `frontend/.env` local con `VITE_API_URL=http://localhost:3001` queda **incrustado** en `frontend/dist` al compilar (el `frontend/dist` local, compilado el 2026-10-07, contiene `localhost:3001`). No despliegues un `dist` compilado en local; ver `fullstack-release-deploy`.
- **Hay que definir `NODE_ENV=production` en Railway/Render**: de ello dependen `trust proxy` (sin él todos los clientes comparten la IP del proxy y un único cupo de límite de tasa), el CORS cerrado y la contraseña aleatoria del Admin. `server.ts` avisa si detecta esas plataformas sin la variable, pero no la corrige.
- Con varias instancias (o si `JWT_SECRET` falta) las sesiones no se comparten: el límite de tasa también vive en memoria. El POS está pensado para una sola instancia con SQLite.
- Hay dos siembras de datos de ejemplo independientes y **distintas**: `init.ts#seedInitialData` (SQL crudo, solo en el primer arranque si no hay categorías: 3 categorías, 3 insumos, 3 productos y una receta, "Receta Hamburguesa con Queso") y `prisma/seed.ts` (`npm run db:seed`: las mismas categorías y productos más 2 insumos extra, receta de Cappuccino, la receta de la hamburguesa se llama "Receta Cheeseburger", y **borra** catálogo, ventas, comandas y movimientos antes de sembrar). Mantenerlas alineadas.
- `npm run db:seed` (`prisma db seed`) depende de `package.json#prisma.seed`; con Prisma 7 esa clave podría tener que pasar a `prisma.config.ts` (no verificado; `prisma.config.ts` hoy solo define el esquema y la URL de la BD).
- **Prueba de carga (T4 de `SECURITY_TEST_REPORT.md`) pendiente de ejecución**: el procedimiento está en `docs/load-testing.md` (ahora exige token y `RATE_LIMIT_DISABLED=true`).

## Resueltos el 2026-10-13

Una línea por hallazgo: qué fue, y dónde está el control o la prueba que lo vigila. Todas las pruebas están en `backend/tests/` o `frontend/tests/`.

**Seguridad**
- S1 (la API no autenticaba): JWT HS256 + roles en el servidor, matriz en `backend/tests/helpers/roleMatrix.ts`; pruebas `auth-middleware`, `auth-roles`, `auth-route-guard` (recorre las rutas registradas y falla si una queda sin token o sin declarar) y `unit/jwt.utils`.
- S2 (`Admin`/`123456` siempre): solo se siembra si no existe, con `ADMIN_INITIAL_PASSWORD` o aleatoria en producción; prueba `security-admin-password`.
- S3 (`details: error` con objetos de Prisma en los 500): helper `errorDetails()` en `utils/http.utils.ts`; pruebas `known-issues` y `unit/http.utils`.
- S4 (CORS abierto y CSP desactivada): `FRONTEND_URL` como lista de orígenes, CSP de helmet en modo enforcing; prueba `security-cors-csp`.
- S5 / T1 del reporte de seguridad (sin límite de tasa): `express-rate-limit` en login y en `/api`; prueba `security-rate-limit`.

**Bugs**
- B5 (borrar categoría con productos daba 500): 400 con la cuenta; `catalog.test.ts` y `CategoryModal.test.jsx`.
- B6 (borrar un producto borraba su historial): 400 "desactívalo"; `orders-stock.test.ts` y `ProductsPage.test.jsx`.
- B7 (comandas sin validar stock ni devolverlo): 400 con `shortages` y devolución con movimientos IN al borrar; `orders-stock.test.ts` y `CreateOrderModal.test.jsx` (queda abierto solo `DIRECT_INVENTORY`).
- B8 (id no numérico o POST sin body daban 500): `router.param` + `validateIdParam`, `ensureBody`, `req.body ?? {}`; pruebas `known-issues` y `security-body`.
- B9 (login sensible a mayúsculas): comparación en JS; `auth-users.test.ts`, `known-issues.test.ts` y `auth.test.jsx` (queda abierto el índice único).
- B10 (receta y descripción no se guardaban al editar): `null` limpia el campo y la receta se reemplaza con `POST /api/recipes`; `catalog.test.ts`, `ProductModal.test.jsx` y `ProductsPage.test.jsx`.
- B11 (`MetricCard` con "+2.5%" inventado): `metric.trend` opcional; `MetricCard.test.jsx`.
- T1 (nombre de categoría en blanco, 201) y T2 (`adjustReason` inválido, 500): ahora 400 en todos los nombres y motivos; `catalog.test.ts` e `ingredients-inventory.test.ts`.
- B12 (el WORKER no podía ajustar stock: el modal enviaba `unitCost` y el servidor solo le admite `adjustStock`/`adjustReason`, 403): el modal solo envía el costo si el usuario es admin; `StockAdjustmentModal.test.jsx`.
- Extras: `saveRecipe`, ajustes y creación de insumos ahora atómicos; cantidades negativas en comandas, pagos, impuestos y descuentos inválidos -> 400.

**Inconsistencias entre capas**
- I1 (`GET /api/users` ignoraba `page/limit`): `{ total, page, limit, totalPages, users }`; `auth-users.test.ts` (queda la búsqueda global).
- I2 (Kardex sin paginar): `?page&limit` en el servidor; `ingredients-inventory.test.ts` (queda la UI).
- I3 (`animate-*` sin definir): definidas en `@theme` con `prefers-reduced-motion`; `tests/config/project-structure.test.js`.
- I4 (`formatCurrency` copiada con dos locales): un solo `common/formatCurrency.js` (es-CO); `project-structure.test.js`.
- I5 / I9 (dos estilos de error y "Failed to fetch" en pantalla): capa HTTP única `config/apiFetch.js`; `apiFetch.test.js` y `project-structure.test.js`.
- I6 (dos estilos de feedback): `showSuccessToast`/`showErrorAlert` en todas las páginas; `project-structure.test.js`.

**Duplicación y código muerto**
- Correlativos copiados en tres services: `utils/sequence.utils.ts` (`unit/sequence.utils.test.ts`).
- `extractErrorMessage` x4, descarga de blob x2, contador de denominaciones x2, paginación propia de `UsersTable`: unificados (`apiFetch.js`, `inventoryService#downloadFile`, `DenominationCounter` + `useDenominationCounts`, `Pagination`).
- Código muerto retirado: `OrderStatusSwitcher.jsx`, la copia compilada `prisma/seed.js`, dependencias `express-validator` y `sqlite3` (y `jest` pasó a devDependencies); `project-structure.test.js` vigila el componente.
- README de la raíz vacío: escrito.

**Operación**
- La BD dependía del directorio de arranque: la ruta de la BD y `backend/.env` se resuelven contra la raíz del backend (`prisma/dbPath.ts`; `ops-db-path.test.ts`).
- Backup solo después de migrar: `initializeDatabase()` copia `pre-migration-<fecha>.db` **antes** de migrar si había tablas y migraciones pendientes (si la copia falla se cancela); el backup diario sigue después.
- Servidor "vivo" con la BD rota: `startup.ts` termina con `exit(1)` si la BD falla o el puerto no abre; `ops-startup.test.ts`.
