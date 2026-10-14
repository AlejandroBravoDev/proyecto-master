# Pruebas automáticas

El repo tiene dos suites independientes. Ninguna toca tu base de datos real ni necesita levantar servidores.

| Capa | Herramientas | Comando (desde la carpeta) | Qué cubre |
|---|---|---|---|
| Backend (`backend/`) | Jest 30 + ts-jest + supertest | `npm test` | unidad (utils) e integración HTTP de todos los módulos contra una SQLite temporal, incluida la seguridad (JWT, roles, límites de tasa, CORS/CSP) y la operación (ruta de la BD, copia previa, arranque) |
| Frontend (`frontend/`) | Vitest 5 + Testing Library + jsdom | `npm test` | utilidades, capa HTTP y sesión, servicios (con `fetch` simulado), componentes, modales, páginas con rol, login/rutas protegidas y pruebas de estructura del código |

Atajos desde `backend/`: `npm run test:all` (ambas suites), `npm run test:coverage`, `npm run test:watch`. En `frontend/`: `npm run test:coverage` y `npm run test:watch`.

Estado actual (2026-10-13): **650 pruebas de backend** (22 suites) y **523 de frontend** (17 archivos), todas en verde. El backend tarda ~1 min y el frontend ~30 s. Ya **no queda ningún `it.failing`**: los bugs de la auditoría están corregidos y sus pruebas son normales.

## Backend

### Cómo funciona el aislamiento

- `src/app.ts` exporta la app Express **sin** `listen()` y una fábrica `createApp(options)` que lee el entorno al crearla (`env`, `rateLimit`, `frontendDist`, `requestLogger` se inyectan en pruebas); `src/server.ts` solo inicializa la BD y escucha (`src/startup.ts` aplica el fallo rápido). Así `supertest` prueba la app sin abrir un puerto.
- `tests/setup/env.ts` (Jest `setupFiles`) corre **antes** de importar nada: fija `NODE_ENV=test`, apunta `SQLITE_DB_PATH` / `SQLITE_BACKUP_DIR` a una carpeta temporal única por archivo de prueba (`%TEMP%/mf-jest-<pid>-<azar>/`), da un `JWT_SECRET` de prueba y **vacía** las variables de seguridad (`FRONTEND_URL`, `TRUST_PROXY`, `RATE_LIMIT_*`, `ADMIN_INITIAL_PASSWORD`...) para que un `backend/.env` local no cambie el resultado. Por eso los archivos corren en paralelo sin pisarse y nunca tocan `backend/prisma/dev.db`. Con `NODE_ENV=test` los límites de tasa por defecto son altísimos; las pruebas de límites inyectan los suyos con `createApp({ rateLimit })`.
- `tests/helpers/testApp.ts` → `useTestApp()` registra `beforeAll` (ejecuta `initializeDatabase()`: migraciones, usuario `Admin`/`123456` y datos de ejemplo, y **inicia sesión como Admin**) y `afterAll` (desconecta Prisma y borra la carpeta temporal). Como toda la API exige token (salvo el login), devuelve:
  - `ctx.api`: cliente supertest que ya manda `Authorization: Bearer <token de Admin>` en cada petición;
  - `ctx.anon`: cliente sin token (para probar el 401);
  - `ctx.adminToken`, `ctx.loginAs(usuario, clave)` (sesión de cualquier usuario) y `ctx.createWorker()` (crea un `WORKER` activo y devuelve su sesión `{ api, token, user, username, password }`).
  También exporta `clientWithToken`, `rawLogin`, `testJwtSecret`, `idByName`, `openCaja`, `closeCaja` y `ADMIN`.
- `tests/helpers/roleMatrix.ts` es la **matriz de roles esperada** por ruta (escrita a mano, independiente de la implementación). `auth-route-guard.test.ts` exige que toda ruta registrada en la app esté en ella (y que no sobren entradas), y `auth-roles.test.ts` la comprueba contra el servidor con un `WORKER` y un `ADMIN`.
- Dentro de un archivo, las pruebas **comparten la BD y se ejecutan en orden**: cada `describe` cuenta una historia (crear → editar → borrar). Si una prueba depende de otra, que quede claro en el nombre.

### Estructura

```
backend/
├── jest.config.js
└── tests/
    ├── tsconfig.json          (extiende el del backend; tipos de Jest)
    ├── setup/env.ts           (BD temporal por archivo, JWT_SECRET de prueba)
    ├── helpers/
    │   ├── testApp.ts         (useTestApp, loginAs, createWorker, idByName, openCaja, closeCaja)
    │   └── roleMatrix.ts      (matriz de roles esperada por ruta)
    ├── unit/                  (funciones puras)
    │   ├── auth.utils.test.ts, jwt.utils.test.ts, http.utils.test.ts
    │   └── sequence.utils.test.ts, recipe.utils.test.ts
    └── integration/           (HTTP + BD real temporal)
        ├── health-and-init.test.ts        health, 404, cabeceras, init idempotente
        ├── auth-users.test.ts             login (sin distinguir mayúsculas), usuarios, último admin, paginación
        ├── auth-middleware.test.ts        JWT: sin token, inválido, vencido, firma ajena, alg none, usuario inactivo, cambio de contraseña, identidad de caja
        ├── auth-roles.test.ts             matriz de roles contra el servidor (WORKER y ADMIN) y sus matices
        ├── auth-route-guard.test.ts       recorre las rutas registradas: 401 sin token y cada ruta declarada en roleMatrix.ts
        ├── catalog.test.ts                categorías, productos, recetas
        ├── ingredients-inventory.test.ts  insumos, Kardex (con paginación), alertas, Excel
        ├── caja.test.ts                   apertura/cierre, denominaciones, historial
        ├── orders-sales-dashboard.test.ts comandas + venta + stock, ventas, KPIs
        ├── orders-stock.test.ts           validación de stock, devolución al borrar la comanda, productos con historial
        ├── security-rate-limit.test.ts    límites de tasa (login y /api), trust proxy
        ├── security-cors-csp.test.ts      CORS por FRONTEND_URL, CSP, trust proxy
        ├── security-body.test.ts          JSON inválido, cuerpo grande, body vacío
        ├── security-admin-password.test.ts contraseña del Admin inicial (variable, aleatoria en producción, 123456 en desarrollo)
        ├── ops-db-path.test.ts            ruta de la BD, copia pre-migration-*
        ├── ops-startup.test.ts            fallo rápido (exit 1) si la BD o el puerto fallan
        └── known-issues.test.ts           regresiones de la auditoría: ids inválidos (B8), 500 sin internals (S3), login sin mayúsculas (B9)
```

Las pruebas viven fuera de `src/` a propósito: `tsc` (build de producción) no las compila a `dist/`.

### Cómo escribir una prueba de endpoint

```ts
import { useTestApp } from '../helpers/testApp';
const ctx = useTestApp();                       // inicia sesión como Admin

it('crea una categoría', async () => {
  const res = await ctx.api.post('/api/categories').send({ name: 'Postres 2' });   // ya lleva el token
  expect(res.status).toBe(201);
});

it('un trabajador no puede crearla (403) ni sin sesión (401)', async () => {
  const worker = await ctx.createWorker();
  expect((await worker.api.post('/api/categories').send({ name: 'X' })).status).toBe(403);
  expect((await ctx.anon.post('/api/categories').send({ name: 'X' })).status).toBe(401);
});
```

Una ruta nueva debe declararse además en `tests/helpers/roleMatrix.ts` (ver skill `backend-new-module`).

### Cobertura de referencia (`npm run test:coverage`)

Cifras de la sesión anterior (anteriores a la remediación de seguridad): ~86 % de líneas y ~92 % de funciones del backend. Vuelve a medirla con `npm run test:coverage` antes de citarla: la suite creció de 88 a 650 pruebas.

## Frontend

- `vitest.config.mjs`: entorno `jsdom`, `tests/setup.js` registra los matchers de `jest-dom`, limpia el DOM y restablece `fetch`/variables de entorno/`sessionStorage` después de cada prueba.
- `tests/helpers/fetchMock.js`: `mockFetch(...respuestas)` (en orden), `mockFetchRoutes({ 'GET /api/x': ... })` (por método y ruta), `jsonResponse(cuerpo, estado)` (con `clone()`), `brokenJsonResponse()`, `blobResponse()` y `callOf(mock, n)` para inspeccionar la llamada (URL, método, cuerpo).
- `tests/helpers/renderWithApp.jsx`: `renderWithApp` / `renderAsAdmin` / `renderAsWorker` montan un componente con **sesión iniciada** (usuario y token en `sessionStorage`; `signInAs`, `TEST_TOKEN`), `AuthProvider` (con `validateOnMount={false}`) y `MemoryRouter` (la app real usa `createHashRouter`).
- Modelos: `tests/components/UserModal.test.jsx` (modal: validación, payload, rol, anti doble envío, error del servidor, edición), `ProductsPage.test.jsx` / `InventoryPage.test.jsx` / `UsersPage.test.jsx` (páginas con roles), `auth.test.jsx` (sesión, `GET /api/auth/me`, 401, rutas protegidas, login) y `tests/config/apiFetch.test.js` (capa HTTP: token, `skipAuth`, 401/403, errores).
- `tests/config/project-structure.test.js`: pruebas de **estructura del código fuente** que fijan decisiones que ninguna otra prueba atrapa: `fetch` solo en `config/apiFetch.js`, el token y `sessionStorage` solo en la capa de sesión, un solo `formatCurrency`, animaciones definidas, sin `showToast` local ni `window.confirm`, `OrderStatusSwitcher` eliminado. Al añadir un service nuevo hay que añadirlo a sus listas.
- Carpetas espejo de `src/`: `tests/config`, `tests/utils`, `tests/services`, `tests/components`. Las pruebas están **fuera de `src/`** para que el `preflight` (reglas `FE-FETCH-OUTSIDE-SERVICE`, `FE-HARDCODED-URL`) no las confunda con código de producción.
- La URL base se fija por prueba con `vi.stubEnv('VITE_API_URL', 'http://localhost:3055')`.

Archivos de prueba del frontend (17): `config/{api,apiFetch,project-structure}`, `utils/{authStorage,utils}`, `services/services`, y `components/{auth,CajaModals,CategoryModal,CreateOrderModal,InventoryPage,MetricCard,Pagination,ProductModal,ProductsPage,UserModal,UsersPage}`.

## Bugs corregidos y sus pruebas

Los bugs de la auditoría (`.claude/skills/fullstack-domain-reference/references/known-issues.md`, sección "Resueltos el 2026-10-13") se escribieron primero como pruebas `it.failing` del comportamiento correcto; al corregirlos se les quitó `.failing` y hoy son pruebas normales que impiden que vuelvan. Si encuentras un bug nuevo que no te toca arreglar, usa `it.failing` para documentarlo (Jest avisa el día que alguien lo corrija) y regístralo en `known-issues.md`.

| Prueba | Hallazgo | Dónde |
|---|---|---|
| API sin token -> 401 y matriz de roles | S1 | `auth-middleware`, `auth-roles`, `auth-route-guard` |
| Límites de tasa del login y de `/api` | S5 / T1 del reporte de seguridad | `security-rate-limit.test.ts` |
| CORS por `FRONTEND_URL`, CSP | S4 | `security-cors-csp.test.ts` |
| Contraseña del Admin inicial | S2 | `security-admin-password.test.ts` |
| Los 500 no filtran el objeto de Prisma; ids inválidos y body vacío -> 400 | S3, B8 | `known-issues.test.ts`, `security-body.test.ts` |
| Borrar categoría con productos -> 400; nombre en blanco -> 400 | B5, T1 | `catalog.test.ts` |
| `adjustReason` inválido -> 400 | T2 | `ingredients-inventory.test.ts` |
| Stock insuficiente -> 400 con `shortages`; devolución al borrar la comanda; producto con historial no se borra | B7, B6 | `orders-stock.test.ts` |
| Login y unicidad de usuarios sin distinguir mayúsculas | B9 | `auth-users.test.ts`, `known-issues.test.ts` |
| Usuarios y Kardex paginados en el servidor | I1, I2 | `auth-users.test.ts`, `ingredients-inventory.test.ts` |

(Los `T1`/`T2` de esta tabla son los hallazgos de pruebas de bugs de `known-issues.md`, no los T1..T4 de `SECURITY_TEST_REPORT.md`.)

## Cómo añadir pruebas

- Módulo o endpoint nuevo/cambiado → skill `backend-testing` (plantilla de prueba de integración con casos obligatorios: éxito, validación 400, 404, duplicado, transacción, 401 y 403 por rol).
- Pantalla, servicio o utilidad nueva → skill `frontend-testing`.
- Orden recomendado al terminar una tarea: `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` → `npm run test:all` → recorrido manual en el navegador (con `Admin` y un `WORKER`) si tocaste UI.

## Qué NO cubren (todavía)

- Pruebas de navegador de extremo a extremo (Playwright): la verificación visual sigue siendo manual (`fullstack-verify-changes`, peldaño 4). Las pruebas de pantalla simulan `fetch`, así que no detectan un desacuerdo entre lo que envía la UI y lo que el servidor admite a un rol (pasó con el formulario de ajuste de stock: enviaba `unitCost` y el servidor daba 403 a un `WORKER`; ahora lo cubre `StockAdjustmentModal.test.jsx`). Al cambiar una acción que la pantalla ofrece al trabajador, comprueba con `callOf(...)` que el cuerpo es exactamente lo que `roleMatrix.ts` admite para ese rol.
- Concurrencia real (dos comandas simultáneas) y migraciones sobre una copia de BD real (eso lo hace `db-check.mjs`).
- Carga: la prueba de carga y de caída está documentada en [`load-testing.md`](load-testing.md) y **pendiente de ejecución**.
- Páginas completas `OrdersPage`, `CajaPage` y `DashboardPage` (sí hay pruebas de sus modales y de `ProductsPage`, `InventoryPage` y `UsersPage`).
