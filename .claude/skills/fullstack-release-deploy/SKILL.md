---
name: fullstack-release-deploy
description: Preparar y desplegar una versión del POS - verificación previa, versionado, build:all, prueba en modo producción local, variables de entorno, SQLite persistente y backups, rollback y diagnóstico de fallos típicos (VITE_API_URL incrustado, CORS, "no such table", SPA sin servir). Úsala al subir a producción/Railway/Render/VPS, subir de versión, publicar, o cuando algo funciona en local y falla desplegado.
---

# Release y despliegue

En producción **un único proceso Node** sirve la API (`/api`) y el SPA compilado (`frontend/dist`), con la BD SQLite como un archivo. Eso hace el despliegue simple, pero con tres trampas: el frontend se compila con variables de entorno **incrustadas**, el SPA debe existir junto al backend en tiempo de ejecución, y la BD debe vivir en disco **persistente**.

## 1. Antes de versionar

1. `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` sin errores (y revisa los avisos nuevos con `--changed`).
2. Si hay migraciones nuevas: `node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --from <copia de la BD de producción>` (descarga una copia del volumen; nunca pruebes sobre el archivo vivo).
3. Revisa `git status`: sin `.env`, `.db`, `dist/` ni credenciales en el diff.
4. Avisa al usuario de cualquier migración destructiva y de hacer copia del `.db` antes de desplegar.

## 2. Versionar

Hay dos `package.json` con versión (`backend` y `frontend`, hoy 2.0.0). Súbelas juntas (también actualiza el `package-lock.json`):

```bash
cd backend  && npm version <x.y.z> --no-git-tag-version
cd ../frontend && npm version <x.y.z> --no-git-tag-version
```
Commit: `chore(release): bump project version to x.y.z` (ver `fullstack-git-commit`). Sigue semver: parche = arreglos, menor = funciones nuevas compatibles, mayor = cambios rompientes (esquema destructivo, contrato de API).

## 3. Compilar

```bash
cd backend && npm run build:all      # = prisma generate -> compila frontend -> tsc
```
Resultado: `frontend/dist` (SPA) y `backend/dist` (servidor). Arranque: `cd backend && npm start` (`node dist/server.js`).

> **Trampa nº 1: Vite incrusta `VITE_API_URL` en el bundle al compilar.** Tu `frontend/.env` local define `VITE_API_URL=http://localhost:3001`; si compilas en tu máquina y subes ese `dist`, todos los navegadores intentarán llamar a *su propio* `localhost:3001` (comprobado en el `dist` local actual). Para producción en el mismo dominio la variable debe estar **ausente o vacía** al compilar: compila en la plataforma (donde no existe tu `.env`), o renombra `frontend/.env` temporalmente. Con `VITE_API_URL` vacío, `getApiBaseUrl()` usa URLs relativas (`/api/...`), sin CORS ni contenido mixto. Nunca la termines en `/api`.

## 4. Probar en modo producción local (obligatorio antes de subir)

```bash
# PowerShell, en backend/ (BD temporal aislada, otro puerto)
$env:SQLITE_DB_PATH="$env:TEMP\mf-prod-test.db"; $env:SQLITE_BACKUP_DIR="$env:TEMP\mf-prod-backups"; $env:PORT="3060"; npm start
# bash
SQLITE_DB_PATH=/tmp/mf-prod-test.db SQLITE_BACKUP_DIR=/tmp/mf-prod-backups PORT=3060 npm start
```
Comprueba: el log dice `[Frontend Web] Sirviendo interfaz de usuario desde: ...frontend/dist`; `GET /health` -> `OK`; `http://localhost:3060/` carga la app (no una página en blanco); login con `Admin` / `123456`; las pestañas de red del navegador llaman a `localhost:3060/api/...` (misma origen) y **no** a `localhost:3001`; Dashboard, Productos, Inventario, Caja y Comandas cargan; recargar en `/#/caja` funciona (el router es de hash).

## 5. Variables de entorno de producción

| Variable | Valor típico | Nota |
|---|---|---|
| `PORT` | la que asigne la plataforma | el servidor ya lee `process.env.PORT` |
| `SQLITE_DB_PATH` | `/data/dev.db` | **ruta absoluta en un volumen persistente**; gana sobre `DATABASE_URL` |
| `SQLITE_BACKUP_DIR` | `/data/backups` | mismo volumen |
| `FRONTEND_URL` | vacía si el SPA lo sirve el mismo backend | si hay otro origen, lista separada por comas; **vacía = CORS abierto a todos** |
| `NODE_ENV` | no se usa | |

En frontend: `VITE_API_URL` ausente (ver trampa nº 1). Comandos de la plataforma: build `cd backend && npm install && cd ../frontend && npm install && cd ../backend && npm run build:all`; start `cd backend && npm start`; health check `/health`. Requiere que `frontend/dist` quede junto a `backend/` (el servidor lo busca en `../frontend/dist`).

## 6. Datos: persistencia, backups y migraciones

- **El disco debe ser persistente.** SQLite es un archivo: en plataformas con sistema de archivos efímero (contenedor sin volumen) los datos se pierden en cada despliegue. El repo menciona un volumen en `/data` (Railway) y una URL de Render; confirma cuál es el destino real y que tenga disco.
- Las migraciones corren **solas al arrancar** (`initializeDatabase()`); el backup diario `backup-YYYY-MM-DD.db` se crea *después* de migrar, así que antes de un despliegue con migración destructiva descarga una copia manual del `.db`.
- Primer arranque en una BD vacía: se siembran datos de ejemplo y el usuario `Admin` / `123456`. **Cambia esa contraseña de inmediato** (Usuarios -> reasignar contraseña).
- Si `initializeDatabase()` falla, el servidor arranca igual y solo registra `[Backend] Error crítico inicializando base de datos`; las rutas darán `no such table`. Revisa siempre los logs del primer arranque.

## 7. Después de desplegar

- [ ] `GET /health` responde; la app carga en la URL pública.
- [ ] Login, y contraseña de `Admin` cambiada.
- [ ] Dashboard, una comanda de prueba (con caja abierta) y el Kardex reflejan el cambio.
- [ ] Existe el backup del día en `SQLITE_BACKUP_DIR`.
- [ ] Recuerda al usuario que **la API no tiene autenticación** (`users-roles.md`): en internet público, cualquiera puede llamarla.

## 8. Rollback

Redespliega el commit anterior. Si hubo migración **aditiva** (tabla/columna nueva), el código viejo suele seguir funcionando con la BD nueva; si fue destructiva, restaura el `.db` anterior (el último `backup-*.db` o tu copia manual) con el servicio detenido. Las migraciones solo van hacia delante: no hay "down".

## 9. Diagnóstico

| Síntoma | Causa probable |
|---|---|
| La app llama a `localhost:3001` desde el navegador | `VITE_API_URL` incrustado en el build (trampa nº 1) |
| Peticiones a `/api/api/...` | `VITE_API_URL` termina en `/api` |
| Dashboard sin datos / URL `undefined/api/...` | endpoints del dashboard (trampa nº 2) |
| `Cannot GET /` | falta `frontend/dist` junto al backend (el log no muestra `[Frontend Web] Sirviendo...`) |
| `no such table` / `no such column` | migración no corrida o falló: revisa el log de arranque; faltaba migración (`preflight` detecta `DB-DRIFT`) |
| Datos que desaparecen tras desplegar | BD en disco efímero: usa `SQLITE_DB_PATH` en un volumen |
| Error de CORS | `FRONTEND_URL` no incluye el origen del frontend |
| Falla `better-sqlite3`/prisma al instalar | versión de Node distinta o falta compilador/binario nativo en la plataforma; usa la misma versión de Node que en local |
| El servidor se cierra al terminar un despliegue | el servidor fuerza salida a los 3 s tras SIGTERM; normal |
