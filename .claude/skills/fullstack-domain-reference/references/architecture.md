# Arquitectura y operación

## Contenido
- Estructura del repo
- Stack y versiones
- Scripts y cómo correr en desarrollo
- Variables de entorno
- Ruta de la BD, migraciones y backups
- Cadena de middlewares y servicio del SPA
- Frontend: arranque, router y URL de la API

## Estructura del repo

```
proyecto-master/
├── backend/
│   ├── prisma/            schema.prisma, seed.ts, migrations/001_initial_schema.sql
│   ├── src/
│   │   ├── server.ts      middlewares, montaje de /api, SPA estático, arranque
│   │   ├── routes/        <modulo>.routes.ts + index.ts (router maestro)
│   │   ├── controllers/   <modulo>.controller.ts  (capa HTTP)
│   │   ├── services/      <modulo>.service.ts     (Prisma + reglas de negocio)
│   │   ├── prisma/        client.ts (singleton), init.ts (migraciones + seed + backup)
│   │   └── utils/         auth.utils.ts (hash scrypt)
│   ├── prisma.config.ts, tsconfig.json, package.json, .env.example
├── frontend/
│   ├── src/
│   │   ├── renderer.jsx   entrada (StrictMode) -> app/router.jsx
│   │   ├── index.css      Tailwind 4 + tokens de marca (@theme)
│   │   ├── config/api.js  getApiBaseUrl()
│   │   └── app/
│   │       ├── router.jsx, layouts/ (MainLayout, Sidebar), auth/, common/
│   │       └── <feature>/ (Page, components/, services/, utils/)
│   ├── index.html, vite.config.mjs, package.json, .env.example
└── .claude/skills/        estas skills
```

Carpetas locales **ignoradas por git** que pueden existir: `dist/`, `dist_electron/`, `backups/`, `prisma/` (raíz) y `backend/dist`, `backend/backups`, `*.db`. Son restos de ejecuciones y de cuando existía Electron; no son código.

## Stack y versiones

| Capa | Tecnología |
|---|---|
| Backend | Node, Express **5.2**, TypeScript 5.7 (CommonJS, ES2020, `strict`), Prisma **7.8** + `@prisma/adapter-better-sqlite3`, better-sqlite3 13, exceljs, multer, helmet, cors, morgan, dotenv |
| Frontend | React **19**, Vite **8**, Tailwind **4** (`@tailwindcss/vite`, tokens en `@theme`), react-router-dom **7**, lucide-react, sweetalert2. JavaScript/JSX (sin TypeScript) |
| BD | SQLite (un archivo) |
| Tests / lint | **No hay** tests ni ESLint/Prettier. `jest`, `express-validator` y `sqlite3` están en `package.json` del backend pero no se usan |

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
| `npm run db:seed` | `ts-node prisma/seed.ts` - **borra datos de catálogo** y siembra ejemplos |
| `npm run db:push`, `db:studio` | existen pero **no** se usan para migrar (ver skill `backend-db-migration`) |

Frontend (`cd frontend`): `npm run dev` (Vite en `:5173`) y `npm run build` (-> `frontend/dist`).

Desarrollo normal = dos terminales: backend en `:3001` y frontend en `:5173`. El frontend en dev apunta a `http://localhost:3001` si no hay `VITE_API_URL`.

Verificación disponible: `npx tsc --noEmit` (backend), `npm run build` (frontend) y el script `fullstack-verify-changes/scripts/preflight.mjs`.

## Variables de entorno

| Variable | Dónde | Efecto |
|---|---|---|
| `PORT` | backend | puerto HTTP (por defecto 3001) |
| `DATABASE_URL` | backend | `file:<ruta>` (relativa al **cwd**) |
| `SQLITE_DB_PATH` | backend | ruta absoluta de la BD; **gana sobre** `DATABASE_URL` (producción con volumen, p. ej. `/data/dev.db`) |
| `SQLITE_BACKUP_DIR` | backend | carpeta de backups (por defecto `<carpeta BD>/../backups`) |
| `FRONTEND_URL` | backend | orígenes CORS separados por coma; **sin definir = cualquier origen** |
| `VITE_API_URL` | frontend (en build) | URL del backend **sin `/api`** (los endpoints ya añaden `/api`); vacía en producción = misma origin |

`dotenv` no sobrescribe variables ya presentes en el entorno.

## Ruta de la BD, migraciones y backups

Orden de resolución (`src/prisma/client.ts` e `init.ts`): `SQLITE_DB_PATH` -> `DATABASE_URL` sin `file:` -> `<cwd>/prisma/dev.db`. Como las rutas relativas dependen del cwd, **arranca siempre desde `backend/`**. Ojo: con `.env` copiado de `.env.example` (`file:./dev.db`) la BD queda en `backend/dev.db`; sin `.env` queda en `backend/prisma/dev.db`.

`initializeDatabase()` (en `server.ts` antes de `listen`) hace, en orden:
1. crea carpetas de BD y backups;
2. `_migrations` + migración `001_initial_schema` (lee `prisma/migrations/001_initial_schema.sql`; si no existe usa el SQL embebido `INITIAL_SCHEMA_SQL`) y siembra datos de ejemplo si `categories` está vacía;
3. migración `002_users_auth_and_session_orders` (idempotente);
4. crea el usuario `Admin` / `123456` si no existe;
5. backup diario `backup-YYYY-MM-DD.db` (si el del día no existe). **Se hace después de migrar**: una migración destructiva corre antes del backup del día.

Si `initializeDatabase()` falla, el servidor arranca igual y solo registra el error.

## Cadena de middlewares (`server.ts`) y SPA

`helmet` (CSP desactivado) -> `cors` (credentials, métodos GET/POST/PUT/DELETE/PATCH/OPTIONS) -> `morgan('dev')` -> `express.json()` + `urlencoded` -> `GET /health` -> `/api` (router maestro) -> estáticos de `frontend/dist` + fallback `app.get('{*splat}')` (sintaxis Express 5; ignora `/api` y `/health`) -> 404 JSON `{ error }` -> manejador global 500 `{ error, details }`.

El directorio del SPA se busca en: `cwd/../frontend/dist`, `cwd/frontend/dist`, `__dirname/../../frontend/dist`, `__dirname/../frontend/dist`. Debe existir `index.html`.

Cierre limpio con SIGTERM/SIGINT (fuerza salida a los 3 s).

## Frontend: arranque, router y URL de la API

- `renderer.jsx` -> `AppRouter` (`app/router.jsx`): `AuthProvider` + `RouterProvider` con **`createHashRouter`** (URLs tipo `/#/productos`).
- Rutas actuales (en español): `/login`, `/` (dashboard), `/productos`, `/comandas`, `/inventario`, `/caja`, `/usuarios` (solo admin). Todas salvo `/login` cuelgan de `ProtectedRoute` + `MainLayout` (Sidebar + `<Outlet/>`).
- `config/api.js#getApiBaseUrl()`: `VITE_API_URL` (sin `/` final) -> en producción `''` (relativo) -> en dev `http://localhost:3001`.
- Cada feature construye sus URLs en `services/endpoints.js` con `getApiBaseUrl()` (nunca leas `import.meta.env.VITE_API_URL` directo).
- Sesión del usuario en `sessionStorage` (`masterfood_auth_user`); no hay token.
