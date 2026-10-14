# Arquitectura y operación

## Contenido
- Estructura del repo
- Stack y versiones
- Scripts y cómo correr en desarrollo
- Variables de entorno
- Ruta de la BD, migraciones y backups
- Cadena de middlewares y servicio del SPA
- Arranque del servidor (fallo rápido)
- Frontend: arranque, router, sesión y URL de la API

## Estructura del repo

```
proyecto-master/
├── backend/
│   ├── prisma/            schema.prisma, seed.ts, migrations/001_initial_schema.sql
│   ├── src/
│   │   ├── app.ts         createApp(): cadena de middlewares, montaje de /api, SPA estático (sin listen)
│   │   ├── server.ts      punto de entrada: inicializa la BD y hace listen (usa startup.ts)
│   │   ├── startup.ts     bootstrapServer(): fallo rápido (exit(1)) si la BD o el puerto fallan
│   │   ├── routes/        <modulo>.routes.ts + index.ts (router maestro: /auth público, luego authenticate)
│   │   ├── controllers/   <modulo>.controller.ts  (capa HTTP)
│   │   ├── services/      <modulo>.service.ts     (Prisma + reglas de negocio)
│   │   ├── middleware/    auth.middleware.ts (authenticate, requireRole, requireAdminOrFields), security.ts (CORS, CSP, trust proxy),
│   │   │                  rateLimit.ts, requestBody.ts (ensureBody, límite 100 kb), errorHandler.ts (404 y 500)
│   │   ├── prisma/        client.ts (singleton), dbPath.ts (ruta de la BD), init.ts (migraciones + Admin + seed + backups)
│   │   ├── types/         express.d.ts (añade req.user al tipo Request)
│   │   └── utils/         auth.utils.ts (hash scrypt), jwt.utils.ts, http.utils.ts (errorDetails, parseId, parsePagination...),
│   │                      sequence.utils.ts (correlativos), sale.utils.ts, recipe.utils.ts, username.utils.ts
│   ├── tests/             Jest: unit/, integration/, helpers/ (testApp.ts, roleMatrix.ts), setup/env.ts
│   ├── prisma.config.ts, tsconfig.json, jest.config.js, package.json, .env.example
├── frontend/
│   ├── src/
│   │   ├── renderer.jsx   entrada (StrictMode) -> app/router.jsx
│   │   ├── index.css      Tailwind 4 + tokens de marca y animaciones (@theme)
│   │   ├── config/        api.js (getApiBaseUrl), apiFetch.js (capa HTTP única: token, 401, errores)
│   │   └── app/
│   │       ├── router.jsx, layouts/ (MainLayout, Sidebar), auth/ (AuthContext, authStorage, LoginPage, ProtectedRoute), common/
│   │       └── <feature>/ (Page, components/, services/, utils/)
│   ├── tests/             Vitest: config/, utils/, services/, components/, helpers/
│   ├── index.html, vite.config.mjs, vitest.config.mjs, package.json, .env.example
├── docs/                  testing.md, load-testing.md
└── .claude/skills/        estas skills
```

Carpetas locales **ignoradas por git** que pueden existir: `dist/`, `dist_electron/`, `backups/`, `prisma/` (raíz) y `backend/dist`, `backend/backups`, `*.db`. Son restos de ejecuciones y de cuando existía Electron; no son código.

## Stack y versiones

| Capa | Tecnología |
|---|---|
| Backend | Node, Express **5.2**, TypeScript 5.7 (CommonJS, ES2020, `strict`), Prisma **7.8** + `@prisma/adapter-better-sqlite3`, better-sqlite3 13, jsonwebtoken (JWT), express-rate-limit, exceljs, multer, helmet, cors, morgan, dotenv |
| Frontend | React **19**, Vite **8**, Tailwind **4** (`@tailwindcss/vite`, tokens en `@theme`), react-router-dom **7**, lucide-react, sweetalert2. JavaScript/JSX (sin TypeScript) |
| BD | SQLite (un archivo) |
| Tests | Backend: Jest 30 + ts-jest + supertest (`backend/tests/`, BD SQLite temporal por archivo; la app Express vive en `src/app.ts` y `server.ts` solo hace `listen`). Frontend: Vitest 5 + Testing Library + jsdom (`frontend/tests/`). Guía: `docs/testing.md` |
| Lint | **No hay** ESLint/Prettier. `express-validator` y `sqlite3` ya no son dependencias (se retiraron); la validación se hace a mano en los controllers |

## Scripts y desarrollo

Backend (`cd backend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | nodemon + ts-node sobre `src/server.ts` (reinicia al cambiar `src`) |
| `npm run build` | `tsc` -> `dist/` |
| `npm start` | `node dist/server.js` |
| `npm run build:frontend` | compila el frontend (`npm --prefix ../frontend run build`) |
| `npm run build:all` | `db:generate` + `build:frontend` + `build` (lo que necesita producción) |
| `npm run db:generate` | `prisma generate` (regenera tipos del cliente tras tocar `schema.prisma`) |
| `npm run db:seed` | `prisma db seed` (usa `package.json#prisma.seed` = `ts-node prisma/seed.ts`) - **borra catálogo, ventas, comandas y movimientos** y siembra ejemplos |
| `npm run db:push`, `db:studio` | existen pero **no** se usan para migrar (ver skill `backend-db-migration`) |
| `npm test`, `test:watch`, `test:coverage`, `test:frontend`, `test:all` | pruebas (ver `docs/testing.md`) |

Frontend (`cd frontend`): `npm run dev` (Vite en `:5173`), `npm run build` (-> `frontend/dist`), `npm test`, `npm run test:watch`, `npm run test:coverage`.

Desarrollo normal = dos terminales: backend en `:3001` y frontend en `:5173`. El frontend en dev apunta a `http://localhost:3001` si no hay `VITE_API_URL`. Con el `backend/.env` de ejemplo (`FRONTEND_URL=http://localhost:5173`) solo ese origen puede llamar a la API desde el navegador: si sirves el frontend en otro puerto (p. ej. `5199` en las verificaciones), el backend tiene que arrancar con `FRONTEND_URL` igual a ese origen.

Verificación disponible: `npx tsc --noEmit` (backend), `npm run build` (frontend), `npm run test:all` y el script `fullstack-verify-changes/scripts/preflight.mjs`.

## Variables de entorno

Ejemplo comentado: `backend/.env.example` (la fuente de verdad de los valores por defecto es el código citado en cada fila). `dotenv` carga `backend/.env` (resuelto contra la raíz del backend, no contra el cwd) y **no sobrescribe** variables ya presentes en el entorno.

| Variable | Dónde | Efecto |
|---|---|---|
| `PORT` | backend | puerto HTTP (por defecto 3001) |
| `NODE_ENV` | backend | **definir `production` en Railway/Render**: activa trust proxy = 1, CORS cerrado sin `FRONTEND_URL` y contraseña aleatoria del Admin inicial. Sin ella rigen los valores de desarrollo (`server.ts` avisa si detecta Railway/Render). `test` lo fija Jest |
| `DATABASE_URL` | backend | `file:<ruta>`; las rutas relativas se resuelven contra la **raíz del backend** (no el cwd) |
| `SQLITE_DB_PATH` | backend | ruta de la BD (relativa a la raíz del backend o absoluta); **gana sobre** `DATABASE_URL` (producción con volumen, p. ej. `/data/dev.db`) |
| `SQLITE_BACKUP_DIR` | backend | carpeta de backups (por defecto `<carpeta BD>/../backups`) |
| `FRONTEND_URL` | backend | lista de orígenes CORS separados por coma (esquema + host + puerto). Definida: **solo** esos orígenes. Sin definir: en producción `origin:false` (solo mismo origen, con aviso al arrancar); en dev/test solo localhost/127.0.0.1/[::1] en cualquier puerto. Ya no abre CORS a todo el mundo |
| `CSP_REPORT_ONLY` | backend | `true` = la CSP de helmet se envía como solo-informe (interruptor de emergencia si algo del frontend se bloquea); por defecto se aplica (enforcing) |
| `TRUST_PROXY` | backend | proxies delante del backend: número, `false` o lista de IPs. Por defecto `1` con `NODE_ENV=production` y `false` en dev/test. Detrás de Railway/Render evita que todos compartan la IP del proxy (un solo cupo de límite de tasa). No uses `true` |
| `RATE_LIMIT_LOGIN_MAX` / `RATE_LIMIT_LOGIN_WINDOW_MS` | backend | intentos de login **fallidos** por IP y ventana (10 / 900000 ms) |
| `RATE_LIMIT_API_MAX` / `RATE_LIMIT_API_WINDOW_MS` | backend | peticiones a `/api` por IP y ventana (600 / 60000 ms). `/health` queda fuera |
| `RATE_LIMIT_DISABLED` | backend | `true` o `1` apaga ambos límites (emergencias y pruebas de carga; no lo dejes en producción). Con `NODE_ENV=test` los límites por defecto son altísimos |
| `JWT_SECRET` | backend | secreto de firma de las sesiones (HS256), **mínimo 32 caracteres**, obligatorio en producción. Si falta se genera uno aleatorio por arranque (sesiones perdidas al reiniciar, no sirve con varias instancias) |
| `JWT_EXPIRES_IN` | backend | vigencia del token (12h por defecto); número = segundos, o "30m", "12h", "7d". Un valor inválido se ignora con aviso |
| `ADMIN_INITIAL_PASSWORD` | backend | contraseña del Admin inicial (mín. 6); solo se usa si el Admin no existe. En producción sin ella: aleatoria impresa una vez en el log; fuera de producción: `123456` |
| `VITE_API_URL` | frontend (en build) | URL del backend **sin `/api`** (los endpoints ya añaden `/api`); vacía en producción = misma origin |

## Ruta de la BD, migraciones y backups

Orden de resolución (`src/prisma/dbPath.ts`, compartido por `client.ts` e `init.ts`): `SQLITE_DB_PATH` -> `DATABASE_URL` sin `file:` -> `<raíz del backend>/prisma/dev.db`. Las rutas relativas se resuelven contra la **raíz del backend** (la carpeta con `package.json`), así que ya no importa desde dónde arranques el proceso. Con `.env` copiado de `.env.example` (`file:./dev.db`) la BD queda en `backend/dev.db`; sin `.env` queda en `backend/prisma/dev.db`.

`initializeDatabase()` (la llama `server.ts` antes de `listen`) hace, en orden:
1. crea carpetas de BD y backups;
2. detecta si la BD ya traía tablas y crea `_migrations`; si había tablas **y** migraciones pendientes, hace una copia `pre-migration-<fecha>.db` en la carpeta de backups **antes** de migrar (si la copia falla, se cancela el arranque);
3. migración `001_initial_schema` (lee `prisma/migrations/001_initial_schema.sql`; si no existe usa el SQL embebido `INITIAL_SCHEMA_SQL`) y siembra datos de ejemplo si `categories` está vacía;
4. migración `002_users_auth_and_session_orders` (idempotente);
5. crea el usuario `Admin` si no existe (contraseña según `ADMIN_INITIAL_PASSWORD`, ver arriba);
6. backup diario `backup-YYYY-MM-DD.db` (si el del día no existe). Se hace **después** de migrar: el que protege una migración es la copia `pre-migration-*`.

Si `initializeDatabase()` lanza, el servidor **no arranca** (ver "Arranque del servidor").

## Cadena de middlewares (`app.ts`) y SPA

`createApp(options)` construye la app leyendo el entorno en ese momento (las pruebas inyectan `env`, `rateLimit`, `frontendDist`; el `export default` es la de producción). Orden:

1. `getJwtSecret()` (avisa si `JWT_SECRET` falta o es corta) y `trust proxy` (`resolveTrustProxy`).
2. `helmet` con **CSP en modo enforcing** (`script-src 'self'`, `connect-src 'self'` + `FRONTEND_URL`, estilos inline y Google Fonts permitidos, sin `upgrade-insecure-requests` para poder servir por HTTP en LAN; ver `middleware/security.ts`).
3. `cors` según `FRONTEND_URL` (credenciales, métodos GET/POST/PUT/DELETE/PATCH/OPTIONS, cabeceras `Content-Type`/`Authorization`/`Accept`; un origen no permitido no recibe cabeceras CORS).
4. `morgan('dev')` (no en `NODE_ENV=test`).
5. Límites de tasa por IP: `/api` global y `POST /api/auth/login` (solo cuenta fallos); 429 en español. `/health` fuera.
6. `express.json({ limit: '100kb' })` + `urlencoded` + `ensureBody` (`req.body = {}` si falta).
7. `GET /health` (público).
8. `/api` (router maestro): `/auth` (público) -> `router.use(authenticate)` -> `/users` (solo ADMIN), categorías, productos, insumos, recetas, comandas, `/sales` (solo ADMIN), inventario, dashboard, caja.
9. Estáticos de `frontend/dist` + fallback `app.get('{*splat}')` (sintaxis Express 5; ignora `/api` y `/health`).
10. `notFoundHandler` (404 JSON) y `errorHandler` (JSON inválido -> 400, cuerpo grande -> 413, resto -> 500 `{ error, details: texto }`).

El directorio del SPA se busca en: `cwd/../frontend/dist`, `cwd/frontend/dist`, `__dirname/../../frontend/dist`, `__dirname/../frontend/dist`. Debe existir `index.html`.

## Arranque del servidor (fallo rápido)

`server.ts` llama a `bootstrapServer()` (`src/startup.ts`): inicializa la BD y abre el puerto. Si la BD falla o el puerto no se puede abrir, registra `console.error` y **termina con `exit(1)`** (antes arrancaba "vivo" con rutas rotas y el health check de la plataforma lo daba por bueno). Cierre limpio con SIGTERM/SIGINT (fuerza salida a los 3 s).

## Frontend: arranque, router, sesión y URL de la API

- `renderer.jsx` -> `AppRouter` (`app/router.jsx`): `AuthProvider` + `RouterProvider` con **`createHashRouter`** (URLs tipo `/#/productos`).
- Rutas actuales (en español): `/login`, `/` (dashboard), `/productos`, `/comandas`, `/inventario`, `/caja`, `/usuarios` (solo admin). Todas salvo `/login` cuelgan de `ProtectedRoute` + `MainLayout` (Sidebar + `<Outlet/>`).
- `config/api.js#getApiBaseUrl()`: `VITE_API_URL` (sin `/` final) -> en producción `''` (relativo) -> en dev `http://localhost:3001`.
- Cada feature construye sus URLs en `services/endpoints.js` con `getApiBaseUrl()` (nunca leas `import.meta.env.VITE_API_URL` directo).
- **Capa HTTP única** `config/apiFetch.js`: todos los services llaman al backend con `requestJson` / `requestBlob` (sobre `apiFetch`); no hay `fetch` directo en ningún otro archivo (`tests/config/project-structure.test.js` lo vigila). `apiFetch` añade `Authorization: Bearer <token>`, traduce el fallo de red a un mensaje en español, y ante un **401** en una petición con token borra la sesión y avisa a `AuthContext` (una sola vez). `skipAuth: true` (solo el login) envía la petición sin token y sin cerrar sesión. Guía de uso: skill `frontend-api-service`.
- **Sesión con token**: `app/auth/authStorage.js` guarda el JWT en `sessionStorage['masterfood_auth_token']` y el usuario en `['masterfood_auth_user']` (con copia en memoria del token si el almacenamiento falla). `AuthContext` valida la sesión con `GET /api/auth/me` al montar y expone `sessionNotice` (aviso de sesión expirada que muestra `LoginPage`). Detalle en `users-roles.md`.
