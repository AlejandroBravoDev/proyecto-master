# Problemas conocidos y legado (no los copies)

Auditoría del 2026-10-09. Cada punto fue comprobado leyendo el código y, cuando se indica **[probado]**, reproduciéndolo contra un backend real. **Antes de apoyarte en uno, vuelve a comprobar que sigue igual**: el código cambia. Úsalo para dos cosas: (1) no replicar estos patrones en código nuevo, (2) avisar al usuario cuando una tarea toque estas zonas. No los arregles "de paso" en un cambio ajeno; propónlos como tarea aparte.

## Contenido
- Seguridad
- Bugs de funcionamiento
- Inconsistencias entre capas
- Duplicación y código muerto
- Operación

## Seguridad

| # | Problema | Dónde | Cómo actuar |
|---|---|---|---|
| S1 | El servidor no autentica ni autoriza: `GET /api/users` responde 200 sin credenciales **[probado]**; cualquiera puede resetear contraseñas | todos los `routes/*.ts` | Avisar si la tarea es sensible. Arreglo real = sesión/JWT + middleware de rol (tarea propia) |
| S2 | Usuario `Admin` / `123456` creado al arrancar si falta | `prisma/init.ts` | Cambiar la contraseña tras desplegar |
| S3 | Muchos 500 devuelven `details: error` con el objeto completo (en un FK devuelve internals de Prisma/SQLite) **[probado]** | controllers (`category`, `product`, `ingredient`, `order`, `recipe`, `sale`...) | En código nuevo usa `details: error.message` |
| S4 | CORS abierto a cualquier origen si no hay `FRONTEND_URL`; CSP de helmet desactivado | `server.ts` | Definir `FRONTEND_URL` en producción |

## Bugs de funcionamiento

| # | Problema | Dónde | Cómo actuar |
|---|---|---|---|
| B1 | **Importación Excel**: `worksheet.eachRow(async ...)` no espera; la respuesta se envía con `created/updated = 0` y errores vacíos mientras las filas se procesan después **[probado]** | `ingredient.service.ts#importIngredientsFromExcel` | Usar el patrón correcto de `backend-excel-import-export` (recolectar filas y `for...of` con `await`) |
| B2 | La importación actualiza `currentStock` de insumos existentes **sin** movimiento de Kardex; la UI promete `.xls/.csv` y 10 MB, pero el backend solo lee `.xlsx` y multer no limita tamaño | `ingredient.service.ts`, `BulkImportModal.jsx`, `ingredient.routes.ts` | Corregir juntos si se toca la importación |
| B3 | `frontend/src/app/dashboard/services/endpoints.js` lee `import.meta.env.VITE_API_URL` directo: en un build de producción sin esa variable la URL queda `undefined/api/dashboard/kpis` | frontend dashboard | Usar `getApiBaseUrl()` como todas las demás features |
| B4 | `frontend/.env.example` define `VITE_API_URL=.../api`, pero los endpoints ya agregan `/api` -> `/api/api/...` | `.env.example` | `VITE_API_URL` es solo el host (sin `/api`) |
| B5 | Borrar una categoría con productos -> **500** (FK restrict) **[probado]**; el texto de `CategoryModal` dice que los productos "quedarán sin categoría" | `category.service.ts`, `CategoryModal.jsx` | Devolver 400 con mensaje claro o reasignar; no prometer lo contrario en la UI |
| B6 | Borrar un producto elimina sus `order_details` y `sale_details` (se pierde historial y los totales dejan de cuadrar) | `product.service.ts#deleteProduct` | Preferir baja lógica (`available = false`) en entidades con historial |
| B7 | Cancelar/eliminar una comanda **no devuelve stock**; vender no valida stock (puede quedar negativo); los productos `DIRECT_INVENTORY` no descuentan nada | `order.service.ts` | Documentarlo; en flujos nuevos usar movimientos compensatorios |
| B8 | Un POST sin body JSON devuelve 500 (en Express 5 `req.body` es `undefined`) y un id no numérico devuelve 500 (`PrismaClientValidationError`) **[probado]** | todos los controllers | En código nuevo: `req.body ?? {}` y `Number.isInteger(id)` -> 400 |
| B9 | El login es sensible a mayúsculas: `admin` -> 401, `Admin` -> 200 **[probado]**; el placeholder sugiere `admin` | `auth.service.ts`, `LoginPage.jsx` | Decidir criterio antes de cambiarlo (afecta la unicidad en `user.service.ts`) |
| B10 | `ProductModal`: al editar, los cambios de receta se ignoran (la receta solo se envía al crear) y vaciar la descripción no se guarda (`'' || undefined` omite el campo) | `ProductModal.jsx` | Para limpiar un campo opcional en edición envía `null` |
| B11 | `MetricCard` muestra un "+2.5%" fijo (dato inventado) | `dashboard/components/MetricCard.jsx` | No mostrar métricas que no vienen del backend |

## Inconsistencias entre capas

| # | Problema | Cómo actuar |
|---|---|---|
| I1 | `UsersPage` pide `?page&limit`, pero `GET /api/users` los ignora y devuelve el array completo (el service del frontend lo normaliza) **[probado]** | Si hay muchos usuarios, implementar paginación en backend con la forma `{ total, page, limit, totalPages, users }` |
| I2 | Toda la paginación real es en cliente (15 por página); `GET /api/inventory/movements` devuelve todos los movimientos | Mover a paginación de servidor cuando crezcan los datos |
| I3 | Clases `animate-fade-in`, `animate-slide-up`, `animate-shake` se usan en ~19 archivos pero **no están definidas** (no generan CSS) **[probado]** | Definirlas en `@theme` (ver `frontend-design-system`) o no depender de ellas |
| I4 | `formatCurrency` está copiada en 6 `utils` con dos locales: `es-CO` -> "US$ 1.299,50" y `en-US` -> "$1,299.50" **[probado]** | Unificar en un único formateador compartido al tocarlo |
| I5 | Dos estilos de error en servicios: `errorData.error` (products, inventory) vs. `extractErrorMessage` con `details` (auth, users, orders, caja) | Código nuevo: ver `frontend-api-service` |
| I6 | Dos estilos de feedback: toast local con estado (`ProductsPage`, `InventoryPage`) vs. `showSuccessToast` de SweetAlert (resto) | Código nuevo: `showSuccessToast` / `showErrorAlert` |
| I7 | Mensajes de error de dominio se identifican por texto (`error.message === 'CODIGO'`) | Mantener la convención en código nuevo; no mezclar con clases de error propias |
| I8 | `frontend/index.html` no tiene `<meta name="viewport" content="width=device-width, initial-scale=1.0">` (en teléfonos/tablets el sitio se renderiza a 980 px y los breakpoints no aplican); el `Sidebar` es fijo de 16 rem sin versión móvil **[probado]** | La app es de tablet/escritorio; soportar móvil es un cambio global aparte |
| I9 | Con el backend caído las pantallas existentes muestran el texto crudo del navegador "Failed to fetch" (en inglés) **[probado]** | Código nuevo: `safeFetch` de `frontend-api-service` |

## Duplicación y código muerto

- Generación de correlativos copiada en `order.service.ts`, `sale.service.ts` y `caja.service.ts` (receta única en `backend-transactions-kardex`).
- `extractErrorMessage` en 4 services; descarga de blob en 2 funciones de `inventoryService.js`; contador de denominaciones en `OpenCajaModal`/`CloseCajaModal`; bloques de error/skeleton repetidos en cada página; `UsersTable` trae paginación propia en vez del componente común `Pagination`.
- Sin uso: `orders/components/OrderStatusSwitcher.jsx`; `backend/prisma/seed.js` (copia compilada vieja de `seed.ts`, versionada); dependencias `jest`, `express-validator`, `sqlite3` del backend.
- El README de la raíz está vacío.

## Operación

- Un `frontend/.env` local con `VITE_API_URL=http://localhost:3001` queda **incrustado** en `frontend/dist` al compilar (comprobado en el `dist` local: `getApiBaseUrl` devuelve ese valor fijo y el dashboard apunta a `http://localhost:3001/api/dashboard/kpis`). No despliegues un `dist` compilado en local; ver `fullstack-release-deploy`.
- La BD depende del directorio de arranque (rutas relativas): arrancar siempre desde `backend/`.
- `initializeDatabase()` hace el backup **después** de migrar; hacer copia manual antes de una migración destructiva.
- Hay dos siembras de datos de ejemplo independientes: `init.ts#seedInitialData` (primer arranque) y `prisma/seed.ts` (`npm run db:seed`, **borra** catálogo). Mantenerlas alineadas.
- Si `initializeDatabase()` lanza, el servidor arranca igual y solo registra el error (las rutas fallarán con "no such table").
