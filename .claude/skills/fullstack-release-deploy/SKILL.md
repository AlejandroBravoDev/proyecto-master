---
name: fullstack-release-deploy
description: Preparar y desplegar una versión del POS - verificación previa, versionado, build:all, prueba en modo producción local, variables de entorno de producción (NODE_ENV, JWT_SECRET, ADMIN_INITIAL_PASSWORD, FRONTEND_URL, TRUST_PROXY, límites de tasa), SQLite persistente y backups, orden de publicación, rollback y diagnóstico de fallos típicos (VITE_API_URL incrustado, CORS, 401 tras desplegar, "no such table", SPA sin servir). Úsala al subir a producción/Railway/Render/VPS, subir de versión, publicar, o cuando algo funciona en local y falla desplegado.
---

# Release y despliegue

En producción **un único proceso Node** sirve la API (`/api`) y el SPA compilado (`frontend/dist`), con la BD SQLite como un archivo. Eso hace el despliegue simple, pero con cuatro trampas: el frontend se compila con variables de entorno **incrustadas**, el SPA debe existir junto al backend en tiempo de ejecución, la BD debe vivir en disco **persistente**, y la seguridad (sesiones, CORS, límites de tasa, contraseña del Admin) **depende de variables de entorno** que hay que definir en la plataforma.

## 1. Antes de versionar

1. `cd backend && npm run test:all` en verde (backend + frontend) y `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` sin errores (y revisa los avisos nuevos con `--changed`).
2. Si hay migraciones nuevas: `node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --from <copia de la BD de producción>` (descarga una copia del volumen; nunca pruebes sobre el archivo vivo).
3. Revisa `git status`: sin `.env`, `.db`, `dist/` ni credenciales en el diff.
4. Avisa al usuario de cualquier migración destructiva y de hacer copia del `.db` antes de desplegar (el servidor guarda además una copia `pre-migration-*` automática, pero no sustituye a la tuya).

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

> **Trampa nº 1: Vite incrusta `VITE_API_URL` en el bundle al compilar.** Tu `frontend/.env` local define `VITE_API_URL=http://localhost:3001`; si compilas en tu máquina y subes ese `dist`, todos los navegadores intentarán llamar a *su propio* `localhost:3001` (el `frontend/dist` local de octubre contiene `localhost:3001`). Para producción en el mismo dominio la variable debe estar **ausente o vacía** al compilar: compila en la plataforma (donde no existe tu `.env`), o renombra `frontend/.env` temporalmente. Con `VITE_API_URL` vacío, `getApiBaseUrl()` usa URLs relativas (`/api/...`), sin CORS ni contenido mixto. Nunca la termines en `/api`.

## 4. Probar en modo producción local (obligatorio antes de subir)

Con `NODE_ENV=production` el servidor se comporta como en la nube (CORS cerrado, trust proxy, sin `123456`), así que pruébalo así, con BD temporal, otro puerto y secretos **de prueba** (nunca los reales):

```bash
# PowerShell, en backend/ (sustituye los marcadores por valores de prueba)
$env:NODE_ENV="production"; $env:SQLITE_DB_PATH="$env:TEMP\mf-prod-test.db"; $env:SQLITE_BACKUP_DIR="$env:TEMP\mf-prod-backups"; $env:PORT="3060"
$env:JWT_SECRET="<texto de prueba de 32+ caracteres>"; $env:ADMIN_INITIAL_PASSWORD="<clave de prueba>"; npm start
# bash
NODE_ENV=production SQLITE_DB_PATH=/tmp/mf-prod-test.db SQLITE_BACKUP_DIR=/tmp/mf-prod-backups PORT=3060 \
JWT_SECRET="<texto de prueba de 32+ caracteres>" ADMIN_INITIAL_PASSWORD="<clave de prueba>" npm start
```
Comprueba: el log dice `[Frontend Web] Sirviendo interfaz de usuario desde: ...frontend/dist` y **ningún** aviso `[Seguridad]` inesperado (sin `JWT_SECRET` avisa de sesiones que no sobreviven al reinicio; sin `ADMIN_INITIAL_PASSWORD` imprime una clave aleatoria **una sola vez**); `GET /health` -> `OK`; `http://localhost:3060/` carga la app (no una página en blanco); login con `Admin` y la clave que definiste; las pestañas de red del navegador llaman a `localhost:3060/api/...` (misma origen) con la cabecera `Authorization` y **no** a `localhost:3001`; Dashboard, Productos, Inventario, Caja y Comandas cargan; `curl http://localhost:3060/api/categories` sin token responde 401; recargar en `/#/caja` funciona (el router es de hash). Si algo se bloquea en la consola con `Content-Security-Policy`, anótalo: la CSP está en modo enforcing.

## 5. Variables de entorno de producción

| Variable | Valor típico | Nota |
|---|---|---|
| `NODE_ENV` | `production` | **obligatoria**: activa trust proxy = 1, CORS cerrado sin `FRONTEND_URL` y la contraseña aleatoria del Admin. Sin ella el servidor se comporta como en desarrollo (avisa si detecta Railway/Render) |
| `JWT_SECRET` | texto aleatorio de 48+ caracteres | **obligatoria**, mínimo 32, secreta (no la subas al repo). Genera una con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Si falta se genera una por arranque: las sesiones mueren en cada reinicio y no funciona con varias instancias. Cambiarla cierra todas las sesiones |
| `ADMIN_INITIAL_PASSWORD` | clave propia (mín. 6) | solo se usa si el `Admin` **no existe** (primer arranque con BD vacía); un Admin existente no cambia. Sin ella, en producción se genera una aleatoria de 24 caracteres y se imprime una vez en el log |
| `PORT` | la que asigne la plataforma | el servidor ya lee `process.env.PORT` |
| `SQLITE_DB_PATH` | `/data/dev.db` | **ruta absoluta en un volumen persistente**; gana sobre `DATABASE_URL` |
| `SQLITE_BACKUP_DIR` | `/data/backups` | mismo volumen |
| `FRONTEND_URL` | vacía si el SPA lo sirve el mismo backend | lista de orígenes separados por coma (`https://pos.midominio.com`). **Vacía en producción = solo mismo origen** (ya no abre CORS a nadie; avisa en el log). Solo hace falta si el frontend vive en otro dominio |
| `TRUST_PROXY` | (por defecto `1`) | proxies delante del backend; en Railway/Render basta el valor por defecto. Si fuera `false` o mal puesto, todos los clientes comparten la IP del proxy y **un solo cupo** de límite de tasa. No uses `true` |
| `RATE_LIMIT_LOGIN_MAX` / `_WINDOW_MS`, `RATE_LIMIT_API_MAX` / `_WINDOW_MS` | 10 fallos / 15 min; 600 / min | opcionales; si las tablets topan con el límite global, sube `RATE_LIMIT_API_MAX`. **Nunca** `RATE_LIMIT_DISABLED=true` en producción |
| `CSP_REPORT_ONLY` | (ausente) | `true` solo como interruptor de emergencia si la CSP bloquea algo del frontend mientras lo corriges |
| `JWT_EXPIRES_IN` | (por defecto `12h`) | opcional; número = segundos o "30m", "12h", "7d" |

En frontend: `VITE_API_URL` ausente (ver trampa nº 1). Comandos de la plataforma: build `cd backend && npm install && cd ../frontend && npm install && cd ../backend && npm run build:all`; start `cd backend && npm start`; health check `/health`. Requiere que `frontend/dist` quede junto a `backend/` (el servidor lo busca en `../frontend/dist`).

**Checklist de variables a definir en Railway/Render** (antes del primer despliegue de esta versión):
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` (32+ caracteres, generado y guardado fuera del repo)
- [ ] `ADMIN_INITIAL_PASSWORD` (solo si la BD aún no tiene Admin; si no, ignórala)
- [ ] `SQLITE_DB_PATH=/data/dev.db` y `SQLITE_BACKUP_DIR=/data/backups` (volumen montado en `/data`)
- [ ] `FRONTEND_URL` solo si el frontend está en otro dominio
- [ ] `RATE_LIMIT_DISABLED` **sin definir**; `VITE_API_URL` **sin definir** en el build

## 6. Orden de publicación: backend y frontend juntos

Esta versión cambió el contrato de sesión: el backend nuevo exige `Authorization: Bearer` en toda la API y el frontend nuevo espera `{ user, token }` del login. **Ninguna mezcla funciona** (frontend viejo + backend nuevo = 401 en todo; frontend nuevo + backend viejo = "El servidor no devolvió una sesión válida"), así que publícalos **a la vez**. Con un solo servicio (el caso normal: `build:all` compila ambos) ya van juntos; si el frontend se aloja aparte, despliega los dos en la misma ventana. Después del primer despliegue, las sesiones abiertas (que no tenían token) piden iniciar sesión de nuevo: avisa al personal.

## 7. Datos: persistencia, backups y migraciones

- **El disco debe ser persistente.** SQLite es un archivo: en plataformas con sistema de archivos efímero (contenedor sin volumen) los datos se pierden en cada despliegue. El repo menciona un volumen en `/data` (Railway) y una URL de Render; confirma cuál es el destino real y que tenga disco.
- Las migraciones corren **solas al arrancar** (`initializeDatabase()`). Si la BD ya tenía datos y hay migraciones pendientes, el servidor guarda antes `pre-migration-<fecha>.db` en `SQLITE_BACKUP_DIR` (si no puede, **cancela el arranque**); el backup diario `backup-YYYY-MM-DD.db` se crea *después* de migrar. Antes de una migración destructiva descarga además una copia manual del `.db`.
- Primer arranque en una BD vacía: se siembran datos de ejemplo y el usuario `Admin` (con `ADMIN_INITIAL_PASSWORD`, o una clave aleatoria impresa **una vez** en el log: cópiala de ahí). Cámbiala después desde Usuarios -> reasignar contraseña.
- **Fallo rápido**: si `initializeDatabase()` falla o el puerto no se puede abrir, el proceso registra el error y **termina con código 1**; la plataforma lo mostrará como despliegue fallido. Lee siempre el log del primer arranque (`[Backend] Error crítico inicializando la base de datos...`).

## 8. Después de desplegar

- [ ] `GET /health` responde; la app carga en la URL pública.
- [ ] El log de arranque no trae avisos `[Seguridad]` inesperados (`JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`).
- [ ] Login con `Admin` y contraseña de `Admin` cambiada (si fue la generada del log).
- [ ] `GET /api/categories` sin token responde 401 (la API no queda abierta).
- [ ] Dashboard, una comanda de prueba (con caja abierta) y el Kardex reflejan el cambio.
- [ ] Existe el backup del día en `SQLITE_BACKUP_DIR`.
- [ ] Riesgos que siguen abiertos y conviene recordar al usuario: `known-issues.md` (token en `sessionStorage`, el WORKER puede editar precios de comanda, etc.).

## 9. Rollback

Redespliega el commit anterior. Si hubo migración **aditiva** (tabla/columna nueva), el código viejo suele seguir funcionando con la BD nueva; si fue destructiva, restaura el `.db` anterior (la copia `pre-migration-*`, el último `backup-*.db` o tu copia manual) con el servicio detenido. Las migraciones solo van hacia delante: no hay "down". Volver a una versión **anterior a la autenticación** deja la API abierta a cualquiera: no lo hagas en internet público. Los tokens son sin estado y no tocan el esquema, así que ir y volver de esta versión no necesita restaurar la BD.

## 10. Diagnóstico

| Síntoma | Causa probable |
|---|---|
| La app llama a `localhost:3001` desde el navegador | `VITE_API_URL` incrustado en el build (trampa nº 1) |
| Peticiones a `/api/api/...` | `VITE_API_URL` termina en `/api` |
| Peticiones a `undefined/api/...` | se leyó `import.meta.env.VITE_API_URL` directo en vez de `getApiBaseUrl()` |
| `Cannot GET /` | falta `frontend/dist` junto al backend (el log no muestra `[Frontend Web] Sirviendo...`) |
| `no such table` / `no such column` | migración no corrida o falló: revisa el log de arranque; faltaba migración (`preflight` detecta `DB-DRIFT`) |
| El servicio se reinicia en bucle o aparece "crashed" al arrancar | `exit(1)` por diseño: la BD no inicializa (ruta/volumen sin permisos, migración fallida, no se pudo crear la copia previa) o el puerto está ocupado; el motivo está en las primeras líneas del log |
| Datos que desaparecen tras desplegar | BD en disco efímero: usa `SQLITE_DB_PATH` en un volumen |
| Error de CORS en el navegador | `FRONTEND_URL` no incluye el origen exacto del frontend (esquema + host + puerto, sin ruta) o, en producción, no está definida y el frontend vive en otro dominio; el log avisa `[CORS] Origen no permitido` |
| Todo da 401 tras desplegar / reiniciar | tokens de la versión anterior (sin `Authorization`), `JWT_SECRET` cambiada o ausente (cada reinicio genera otra y mata las sesiones), o el usuario fue desactivado / cambió su contraseña (`code` en la respuesta: `NO_TOKEN`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `USER_INACTIVE`) |
| Todos los usuarios reciben 429 a la vez | `NODE_ENV` no es `production` o `TRUST_PROXY` mal puesto: todos comparten la IP del proxy (un solo cupo). También si el límite de login (10 fallos / 15 min por IP) se agotó con intentos fallidos |
| No recuerdo la contraseña del `Admin` en un primer arranque | si no definiste `ADMIN_INITIAL_PASSWORD`, la aleatoria se imprimió **una vez** en el log del primer arranque; si ya no está, hay que resetearla (reasignar contraseña desde otro admin, o recrear la BD de prueba) |
| El navegador bloquea algo con `Content-Security-Policy` | la CSP está en enforcing: corrige el origen/recurso bloqueado en `middleware/security.ts`; de emergencia `CSP_REPORT_ONLY=true` |
| Falla `better-sqlite3`/prisma al instalar | versión de Node distinta o falta compilador/binario nativo en la plataforma; usa la misma versión de Node que en local |
| El servidor se cierra al terminar un despliegue | el servidor fuerza salida a los 3 s tras SIGTERM; normal |
