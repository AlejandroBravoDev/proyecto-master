# MasterFood POS

Sistema de punto de venta y gestión para restaurantes: comandas, ventas, caja, inventario con Kardex, recetas y dashboard de KPIs. Interfaz en español.

Es un monorepo con dos apps npm independientes (no hay `package.json` en la raíz). En producción **un solo proceso Node** sirve la API y el frontend compilado.

| Capa | Tecnología |
|---|---|
| Backend (`backend/`) | Node, Express 5, TypeScript 5.7, Prisma 7 + `better-sqlite3`, JWT |
| Frontend (`frontend/`) | React 19, Vite 8, Tailwind 4, react-router 7 (`createHashRouter`), SweetAlert2 |
| Base de datos | SQLite (un solo archivo) |

## Funcionalidades

- **Caja**: apertura y cierre con arqueo por denominaciones.
- **Comandas y ventas**: toma de pedidos, cobro y métodos de pago. Sin caja abierta no se pueden crear comandas, y no se vende lo que no alcanza en stock.
- **Inventario**: insumos, recetas y Kardex. Cada cambio de stock deja un movimiento en la misma transacción; eliminar una comanda devuelve el stock.
- **Catálogo**: categorías, productos e insumos, con importación y exportación Excel.
- **Usuarios y roles**: login con sesión JWT y permisos por rol (`ADMIN` / `WORKER`) **validados en el servidor** y reflejados en la UI.
- **Dashboard**: KPIs de ventas e inventario.

## Inicio rápido

Requisitos: Node.js 22 o superior y npm.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
npm run db:generate
npm run dev            # http://localhost:3001
```

```bash
# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Al primer arranque el backend crea la base de datos, siembra datos de ejemplo si está vacía y crea el usuario `Admin`. **Solo en desarrollo** (sin `NODE_ENV=production`) su contraseña es `123456` si no defines `ADMIN_INITIAL_PASSWORD`; en producción nunca se usa (ver [Autenticación y roles](#autenticación-y-roles)). En desarrollo el frontend apunta a `http://localhost:3001` salvo que definas `VITE_API_URL`, y el `.env` de ejemplo solo deja llamar a la API desde `http://localhost:5173` (`FRONTEND_URL`).

> Las rutas relativas de la BD y el `backend/.env` se resuelven contra la carpeta `backend/`, así que no importa desde dónde arranques el proceso. Aun así, usa los scripts de `npm` desde `backend/`.

## Scripts

Backend (`cd backend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | nodemon + ts-node, reinicia al cambiar `src/` |
| `npm run build` | compila TypeScript a `dist/` |
| `npm start` | ejecuta `dist/server.js` |
| `npm run build:all` | `prisma generate` + build del frontend + build del backend (lo que necesita producción) |
| `npm run db:generate` | regenera el cliente de Prisma tras tocar `schema.prisma` |
| `npm run db:seed` | siembra datos de ejemplo. **Borra catálogo, ventas, comandas y movimientos** |

Frontend (`cd frontend`): `npm run dev` (Vite, puerto 5173) y `npm run build` (genera `frontend/dist`).

Pruebas (detalle en [`docs/testing.md`](docs/testing.md); estado a 2026-10-13: **backend 22 suites / 650 pruebas, frontend 17 archivos / 523 pruebas**, todas en verde):

| Script | Qué hace |
|---|---|
| `npm test` (en `backend/` o `frontend/`) | ejecuta la suite de esa capa (Jest + supertest / Vitest + Testing Library) |
| `npm run test:all` (en `backend/`) | ejecuta ambas suites |
| `npm run test:coverage` | informe de cobertura de esa capa |
| `npm run test:watch` | modo interactivo al editar |

Las pruebas del backend usan una SQLite temporal por archivo: no tocan tu `dev.db`. La prueba de carga ([`docs/load-testing.md`](docs/load-testing.md)) está documentada pero **pendiente de ejecución**.

## Configuración

Variables de entorno (ejemplo comentado en `backend/.env.example` y `frontend/.env.example`):

| Variable | Dónde | Descripción |
|---|---|---|
| `PORT` | backend | Puerto HTTP. Por defecto `3001` |
| `NODE_ENV` | backend | **Defínela como `production` en Railway/Render**: activa trust proxy, CORS cerrado sin `FRONTEND_URL` y la contraseña aleatoria del Admin inicial |
| `DATABASE_URL` | backend | `file:<ruta>`; las rutas relativas se resuelven contra `backend/` |
| `SQLITE_DB_PATH` | backend | Ruta de la BD (absoluta en producción). Tiene prioridad sobre `DATABASE_URL` |
| `SQLITE_BACKUP_DIR` | backend | Carpeta de backups. Por defecto `<carpeta de la BD>/../backups` |
| `FRONTEND_URL` | backend | Orígenes (esquema + host + puerto) que pueden llamar a la API desde un navegador, separados por coma. Definida: solo esos. Sin definir: en producción solo el mismo origen; en desarrollo, localhost en cualquier puerto |
| `JWT_SECRET` | backend | Secreto de las sesiones (mínimo 32 caracteres). **Obligatorio en producción**; sin él se genera uno por arranque y las sesiones se pierden al reiniciar |
| `JWT_EXPIRES_IN` | backend | Vigencia del token. Por defecto `12h` (segundos, o `30m`, `12h`, `7d`) |
| `ADMIN_INITIAL_PASSWORD` | backend | Contraseña del `Admin` cuando **aún no existe** (mín. 6). En producción, si falta, se genera una aleatoria y se imprime una sola vez en el log |
| `TRUST_PROXY` | backend | Proxies delante del backend. Por defecto `1` en producción, desactivado en desarrollo |
| `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_LOGIN_WINDOW_MS` | backend | Intentos de login **fallidos** por IP y ventana (10 / 15 min) |
| `RATE_LIMIT_API_MAX`, `RATE_LIMIT_API_WINDOW_MS` | backend | Peticiones a `/api` por IP y ventana (600 / 1 min) |
| `RATE_LIMIT_DISABLED` | backend | `true` apaga los límites (solo emergencias y pruebas de carga) |
| `CSP_REPORT_ONLY` | backend | `true` envía la Content-Security-Policy solo como informe (interruptor de emergencia) |
| `VITE_API_URL` | frontend | URL del backend **sin** `/api`. Se incrusta al compilar. Vacía en producción = mismo origen |

## Autenticación y roles

Toda la API exige `Authorization: Bearer <token>` salvo `POST /api/auth/login` (que devuelve `{ user, token }`) y `GET /health`. El servidor relee al usuario de la base de datos en cada petición: desactivar a alguien, cambiarle el rol o cambiarle la contraseña surte efecto al instante (cambiar la contraseña invalida los tokens anteriores). El login se limita a 10 intentos fallidos por IP cada 15 minutos.

| Rol | Puede |
|---|---|
| `ADMIN` | todo: usuarios, ventas, catálogo, recetas, insumos, importar Excel, editar sesiones de caja y ver todo el historial de comandas |
| `WORKER` | tomar y consultar comandas **del turno actual**, abrir y cerrar caja, ajustar stock, marcar productos disponibles/agotados y consultar catálogo, inventario, Kardex y dashboard |

La matriz completa por ruta está en [`users-roles.md`](.claude/skills/fullstack-domain-reference/references/users-roles.md) y es ejecutable en `backend/tests/helpers/roleMatrix.ts` (una prueba falla si una ruta nueva no declara su rol). En el navegador la sesión vive en `sessionStorage` y un 401 devuelve al login con un aviso.

## Estructura

```
proyecto-master/
├── backend/
│   ├── prisma/          schema.prisma, seed.ts, migrations/
│   ├── tests/           pruebas Jest: unit/, integration/, helpers/, setup/
│   └── src/
│       ├── app.ts       app Express: middlewares, rutas /api, SPA estático (sin listen)
│       ├── server.ts    inicializa la BD y escucha en el puerto (startup.ts: fallo rápido)
│       ├── routes/      una ruta por módulo + index.ts
│       ├── controllers/ capa HTTP
│       ├── services/    reglas de negocio y acceso a datos
│       ├── middleware/  autenticación y roles, seguridad (CORS/CSP), límites de tasa, errores
│       ├── prisma/      client.ts, dbPath.ts, init.ts (migraciones, seed, backups)
│       └── utils/
├── frontend/
│   ├── tests/           pruebas Vitest: config/, utils/, services/, components/, helpers/
│   └── src/
│       ├── config/      api.js (URL base), apiFetch.js (capa HTTP única: token, 401, errores)
│       └── app/         router.jsx, layouts/, auth/, common/ y una carpeta por feature
└── docs/                testing.md, load-testing.md
```

## API

Todas las rutas cuelgan de `/api`; además existe `GET /health`. Catálogo completo con contratos y errores: [`api-endpoints.md`](.claude/skills/fullstack-domain-reference/references/api-endpoints.md).

| Prefijo | Módulo |
|---|---|
| `/api/auth`, `/api/users` | Login, sesión y usuarios (solo admin) |
| `/api/categories`, `/api/products` | Catálogo |
| `/api/ingredients`, `/api/recipes` | Insumos y recetas |
| `/api/orders`, `/api/sales` | Comandas y ventas (`/sales` solo admin) |
| `/api/inventory` | Kardex y alertas de stock |
| `/api/caja` | Apertura, cierre y arqueo |
| `/api/dashboard` | KPIs |

Convención de respuestas: éxito = JSON directo (objeto o array), borrado = `{ message }`, error = `{ error: "mensaje" }` (los 401 añaden `code`). Códigos: 400 validación, 401 sin sesión válida, 403 sin permiso, 404, 413 cuerpo mayor de 100 kb, 429 límite de tasa.

## Base de datos

El esquema **no se migra con `prisma migrate`**. `backend/src/prisma/init.ts` crea y actualiza las tablas al arrancar con migraciones incrementales escritas a mano. Si cambias `schema.prisma`, añade también la migración allí; de lo contrario las bases de datos nuevas quedarán desalineadas.

Los backups de SQLite se guardan en la carpeta indicada por `SQLITE_BACKUP_DIR`: un backup diario `backup-<día>.db` y, antes de aplicar migraciones sobre una BD que ya tenía datos, una copia `pre-migration-<fecha>.db`. Si la BD no se puede inicializar, el servidor termina con código 1 en vez de arrancar roto.

## Despliegue

```bash
cd backend
npm install
npm run build:all
npm start
```

El backend detecta `frontend/dist` y lo sirve junto con la API, así que basta un único servicio. Para que los datos persistan en plataformas como Railway o Render, monta un volumen y define `SQLITE_DB_PATH` y `SQLITE_BACKUP_DIR` apuntando a él (por ejemplo `/data/dev.db` y `/data/backups`).

Variables a definir en Railway/Render antes del primer despliegue de esta versión:

- `NODE_ENV=production` (obligatoria).
- `JWT_SECRET` con 32 o más caracteres (obligatoria; genera una con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
- `ADMIN_INITIAL_PASSWORD` si la base de datos aún no tiene `Admin`; si no la defines, copia la clave aleatoria que se imprime una sola vez en el log del primer arranque.
- `SQLITE_DB_PATH` y `SQLITE_BACKUP_DIR` en el volumen.
- `FRONTEND_URL` solo si el frontend vive en otro dominio.

Como `VITE_API_URL` se incrusta al compilar, déjala vacía si frontend y backend comparten origen, o defínela **antes** de ejecutar `build:all`. Backend y frontend se publican **juntos** (el frontend nuevo envía el token y el backend nuevo lo exige). Guía completa, prueba en modo producción local y diagnóstico: skill `fullstack-release-deploy`.

## Limitaciones conocidas

Lista viva y verificada en [`known-issues.md`](.claude/skills/fullstack-domain-reference/references/known-issues.md). Las principales:

- El token vive en `sessionStorage` (legible por un XSS; la CSP lo mitiga), no hay renovación del token ni cierre de sesión de servidor, y el login se limita solo por IP.
- Un `WORKER` puede fijar precios, impuestos y descuentos de una comanda y borrar comandas del turno actual sin que quede rastro de quién lo hizo; los ajustes de stock tampoco guardan quién los hizo.
- Los productos de venta directa (`DIRECT_INVENTORY`) no descuentan inventario (requiere un cambio de esquema).
- La app está pensada para tablet y escritorio (no hay versión móvil) y no hay linter configurado.
- Los montos se guardan como `Float` en USD y se redondean a 2 decimales.

## Licencia

MIT
