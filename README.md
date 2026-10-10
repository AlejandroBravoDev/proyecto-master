# MasterFood POS

Sistema de punto de venta y gestión para restaurantes: comandas, ventas, caja, inventario con Kardex, recetas y dashboard de KPIs. Interfaz en español.

Es un monorepo con dos apps npm independientes (no hay `package.json` en la raíz). En producción **un solo proceso Node** sirve la API y el frontend compilado.

| Capa | Tecnología |
|---|---|
| Backend (`backend/`) | Node, Express 5, TypeScript 5.7, Prisma 7 + `better-sqlite3` |
| Frontend (`frontend/`) | React 19, Vite 8, Tailwind 4, react-router 7 (`createHashRouter`), SweetAlert2 |
| Base de datos | SQLite (un solo archivo) |

## Funcionalidades

- **Caja**: apertura y cierre con arqueo por denominaciones.
- **Comandas y ventas**: toma de pedidos, cobro y métodos de pago. Sin caja abierta no se pueden crear comandas.
- **Inventario**: insumos, recetas y Kardex. Cada cambio de stock deja un movimiento en la misma transacción.
- **Catálogo**: categorías, productos e insumos, con importación y exportación Excel.
- **Usuarios y roles**: login y permisos por rol aplicados en la UI.
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

Al primer arranque el backend crea la base de datos y siembra datos de ejemplo si está vacía. En desarrollo el frontend apunta a `http://localhost:3001` salvo que definas `VITE_API_URL`.

> Arranca siempre el backend desde la carpeta `backend/`: las rutas relativas de la BD dependen del directorio de trabajo.

## Scripts

Backend (`cd backend`):

| Script | Qué hace |
|---|---|
| `npm run dev` | nodemon + ts-node, reinicia al cambiar `src/` |
| `npm run build` | compila TypeScript a `dist/` |
| `npm start` | ejecuta `dist/server.js` |
| `npm run build:all` | `prisma generate` + build del frontend + build del backend (lo que necesita producción) |
| `npm run db:generate` | regenera el cliente de Prisma tras tocar `schema.prisma` |
| `npm run db:seed` | siembra datos de ejemplo. **Borra datos de catálogo** |

Frontend (`cd frontend`): `npm run dev` (Vite, puerto 5173) y `npm run build` (genera `frontend/dist`).

## Configuración

Variables de entorno (ejemplo en `backend/.env.example` y `frontend/.env.example`):

| Variable | Dónde | Descripción |
|---|---|---|
| `PORT` | backend | Puerto HTTP. Por defecto `3001` |
| `DATABASE_URL` | backend | `file:<ruta>`, relativa al directorio de trabajo |
| `SQLITE_DB_PATH` | backend | Ruta absoluta de la BD. Tiene prioridad sobre `DATABASE_URL` |
| `SQLITE_BACKUP_DIR` | backend | Carpeta de backups. Por defecto `<carpeta de la BD>/../backups` |
| `FRONTEND_URL` | backend | Orígenes CORS separados por coma. Sin definir, acepta cualquier origen |
| `VITE_API_URL` | frontend | URL del backend **sin** `/api`. Se incrusta al compilar. Vacía en producción = mismo origen |

## Estructura

```
proyecto-master/
├── backend/
│   ├── prisma/          schema.prisma, seed.ts, migrations/
│   └── src/
│       ├── server.ts    middlewares, rutas /api, SPA estático
│       ├── routes/      una ruta por módulo + index.ts
│       ├── controllers/ capa HTTP
│       ├── services/    reglas de negocio y acceso a datos
│       ├── prisma/      client.ts, init.ts (migraciones, seed, backup)
│       └── utils/
└── frontend/
    └── src/
        ├── config/api.js
        └── app/         router.jsx, layouts/, common/ y una carpeta por feature
```

## API

Todas las rutas cuelgan de `/api`; además existe `GET /health`.

| Prefijo | Módulo |
|---|---|
| `/api/auth`, `/api/users` | Login y usuarios |
| `/api/categories`, `/api/products` | Catálogo |
| `/api/ingredients`, `/api/recipes` | Insumos y recetas |
| `/api/orders`, `/api/sales` | Comandas y ventas |
| `/api/inventory` | Kardex y alertas de stock |
| `/api/caja` | Apertura, cierre y arqueo |
| `/api/dashboard` | KPIs |

Convención de respuestas: éxito = JSON directo (objeto o array), borrado = `{ message }`, error = `{ error: "mensaje" }`.

## Base de datos

El esquema **no se migra con `prisma migrate`**. `backend/src/prisma/init.ts` crea y actualiza las tablas al arrancar con migraciones incrementales escritas a mano. Si cambias `schema.prisma`, añade también la migración allí; de lo contrario las bases de datos nuevas quedarán desalineadas.

Los backups de SQLite se guardan en la carpeta indicada por `SQLITE_BACKUP_DIR`.

## Despliegue

```bash
cd backend
npm install
npm run build:all
npm start
```

El backend detecta `frontend/dist` y lo sirve junto con la API, así que basta un único servicio. Para que los datos persistan en plataformas como Railway o Render, monta un volumen y define `SQLITE_DB_PATH` y `SQLITE_BACKUP_DIR` apuntando a él (por ejemplo `/data/dev.db` y `/data/backups`).

Como `VITE_API_URL` se incrusta al compilar, déjala vacía si frontend y backend comparten origen, o defínela **antes** de ejecutar `build:all`.

## Limitaciones conocidas

- **No hay autenticación en el servidor**: los roles solo restringen la interfaz y la API no valida sesiones. No expongas la API a internet sin una capa adicional de protección.
- No hay tests automatizados ni linter configurados.
- Los montos se guardan como `Float` en USD y se redondean a 2 decimales.

## Licencia

MIT
