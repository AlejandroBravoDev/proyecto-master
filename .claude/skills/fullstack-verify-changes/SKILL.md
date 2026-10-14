---
name: fullstack-verify-changes
description: Verificación antes de dar por terminado cualquier cambio de código del POS - typecheck del backend, build del frontend, deriva entre schema.prisma y las migraciones, convenciones del proyecto, pruebas de la API (api.mjs, que inicia sesión sola) y recorrido en el navegador con ambos roles. Úsala SIEMPRE al terminar una tarea de código, antes de un commit o PR, y cuando pidan verificar, probar, "revisar que todo compile" o comprobar un flujo.
---

# Verificar cambios (la escalera de verificación)

"Compila" no es "funciona". El proyecto tiene pruebas automáticas (backend: Jest + supertest, 22 suites / 650 pruebas; frontend: Vitest + Testing Library, 17 archivos / 523 pruebas; ver `docs/testing.md`) pero no linter, y esas pruebas no sustituyen mirar la pantalla ni probar la API a mano, así que la verificación combina pruebas, scripts y comprobaciones manuales. Súbela peldaño a peldaño según lo que tocaste; cada uno detecta una clase distinta de fallo. Las herramientas están en `scripts/` (Node, sin dependencias nuevas, funcionan en PowerShell, cmd y Git Bash).

## Peldaño 0 - Pruebas automáticas (siempre, es lo más barato)

```bash
cd backend && npm run test:all     # backend (Jest) + frontend (Vitest); ~1-2 min
```
Si tocaste una sola capa basta `npm test` en esa carpeta. Una prueba que falla es información, no ruido: corrige el código o, si el comportamiento cambió a propósito, actualiza la prueba **y** la referencia de `fullstack-domain-reference` en el mismo cambio. Si falla `auth-route-guard`, hay una ruta nueva sin declarar en `backend/tests/helpers/roleMatrix.ts` (o una guardia de rol sin entrada); si falla `project-structure` (frontend), alguien llamó a `fetch` fuera de `config/apiFetch.js` o tocó el token fuera de la capa de sesión. Código nuevo sin prueba no está terminado: usa `backend-testing` / `frontend-testing`.

## Peldaño 1 - Preflight (siempre)

```bash
node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs            # todo
node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --changed  # solo avisos en las líneas que tocaste
```

Hace: `tsc --noEmit` del backend, `vite build` del frontend a una carpeta temporal (no ensucia `frontend/dist`), compara `schema.prisma` con el SQL de las migraciones, comprueba que cada `*.routes.ts` y cada `*Page.jsx` esté registrado, escanea convenciones y revisa que las rutas y modelos estén documentados. Sale con código 1 si hay **errores**; los **avisos** (⚠) son consejos: úsalos con `--changed` para ver solo lo que añadiste tú. A 2026-10-13 el repo no arrastra avisos. El preflight **no** revisa roles: de eso se encarga la prueba-guardia de Jest.

| Regla | Nivel | Qué detecta y qué hacer |
|---|---|---|
| `DB-DRIFT` | error | un modelo/columna de `schema.prisma` no está en las migraciones -> `backend-db-migration` |
| `BE-ROUTE-UNREGISTERED` / `FE-ROUTE-MISSING` | error | ruta o página sin registrar en `routes/index.ts` / `router.jsx` |
| `FE-HOOK-AFTER-RETURN` | error | hook después de `if (!isOpen) return null` (rompe React) |
| `BE-PRISMA-IN-TX` | error | `prisma.` dentro de `$transaction(async (tx) => ...)`: usa `tx.` |
| `FE-NATIVE-DIALOG` | aviso | `window.confirm/alert/prompt` -> `frontend-alerts-dialogs` |
| `FE-ENV-DIRECT` | aviso | `import.meta.env.VITE_API_URL` fuera de `config/api.js` -> `getApiBaseUrl()` |
| `FE-HARDCODED-URL` | aviso | URL escrita a mano fuera de `services/endpoints.js` -> `frontend-api-service` |
| `FE-FETCH-OUTSIDE-SERVICE` | aviso | `fetch(` en cualquier archivo salvo `config/apiFetch.js` (la capa HTTP única, único exento): los services usan `requestJson` / `requestBlob` -> `frontend-api-service` |
| `FE-UNDEFINED-ANIMATION` | aviso | `animate-fade-in/slide-up/shake` sin definir en `index.css` (hoy están definidas; avisa si alguien las quita) |
| `BE-DETAILS-OBJECT` | aviso | `details: error` filtra internals: `errorDetails(error)` |
| `BE-BODY-DESTRUCTURE` | aviso | `= req.body;` sin `?? {}` (POST vacío -> 500 en Express 5) |
| `BE-REQ-MUTATION` | aviso | asignar a `req.query`/`req.params` no tiene efecto en Express 5 |
| `BE-EACHROW-ASYNC` | aviso | `eachRow(async ...)` no espera -> `backend-excel-import-export` |
| `DOC-API-MISSING` / `DOC-MODEL-MISSING` | aviso | ruta o modelo no documentados en `fullstack-domain-reference` |

Opciones: `--skip-build`, `--skip-typecheck` (más rápido), `--strict` (avisos fallan), `--verbose`, `--root <dir>`.

## Peldaño 2 - Migraciones (si tocaste `schema.prisma` o `init.ts`)

```bash
node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --table <tabla_nueva>
node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --from backend/prisma/dev.db   # o la ruta de tu BD
```
BD vacía y copia de tu BD real (nunca modifica la original); ejecuta `initializeDatabase()` dos veces, exige idempotencia, `integrity_check` y `foreign_key_check`, y lista tablas/migraciones. Comprueba también que el id de la migración nueva está en `MIGRATION_IDS` (copia previa automática).

## Peldaño 3 - API (si tocaste backend)

Levanta el backend **aislado** (no ensucia tu BD real ni choca con el puerto 3001):

```bash
# PowerShell (en backend/)
$env:SQLITE_DB_PATH="$env:TEMP\mf-test.db"; $env:SQLITE_BACKUP_DIR="$env:TEMP\mf-test-backups"; $env:PORT="3055"; $env:JWT_SECRET="<texto de prueba de 32+ caracteres>"; npm run dev
# bash (en backend/)
SQLITE_DB_PATH=/tmp/mf-test.db SQLITE_BACKUP_DIR=/tmp/mf-test-backups PORT=3055 JWT_SECRET="<texto de prueba de 32+ caracteres>" npm run dev
```
`JWT_SECRET` fijo evita que cada reinicio de nodemon invalide las sesiones abiertas (sin ella se genera un secreto distinto por arranque y se avisa). Con una BD nueva y sin `NODE_ENV=production`, el usuario es `Admin` / `123456`.

**Toda la API exige token**, y `api.mjs` lo resuelve solo: inicia sesión como `Admin` (login automático con la contraseña de desarrollo, que solo existe en una BD de prueba nueva) y adjunta `Authorization: Bearer`. Opciones: `--as <usuario> --password <clave>` para otro rol, `--no-auth` para comprobar el 401, `--token <jwt>` / `API_TOKEN` para reutilizar uno. A un host que no sea localhost no manda la contraseña por defecto.

```bash
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 GET /api/categories
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 POST /api/suppliers name=Acme phone=555
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 POST /api/purchases --json "{supplierId:1,items:[{ingredientId:1,quantity:5,unitCost:0.6}]}"
node .../api.mjs --url ... POST /api/users fullName="Ana" username=ana password=secreto1 role=WORKER    # crea un WORKER
node .../api.mjs --url ... --as ana --password secreto1 GET /api/users                                  # -> 403 (solo ADMIN)
node .../api.mjs --url ... --no-auth GET /api/categories                                                 # -> 401 NO_TOKEN
node .../api.mjs --url ... POST /api/x/import/x --upload file=./archivo.xlsx   # multipart
node .../api.mjs --url ... GET /api/x/template/x --out plantilla.xlsx           # descarga binaria
```
(También `API_URL=http://localhost:3055` en vez de `--url`.) Devuelve código 0 en 2xx y 1 en otro caso. Para cada endpoint prueba: camino feliz, body vacío (400), id no numérico (400), id inexistente (404), duplicado (400), **sin token (401) y con un WORKER (403 si es solo admin)**, y si hay transacción, un fallo a mitad (nada debe quedar guardado). Comprueba en la respuesta que los mensajes estén en español. El login con contraseña incorrecta cuenta para el límite (10 fallos / 15 min por IP): si lo agotas, espera o reinicia el backend de prueba con `RATE_LIMIT_DISABLED=true`.

## Peldaño 4 - UI (si tocaste frontend)

Con el backend aislado del peldaño 3, en `frontend/`:

```bash
# PowerShell
$env:VITE_API_URL="http://localhost:3055"; npm run dev -- --port 5199
# bash
VITE_API_URL=http://localhost:3055 npm run dev -- --port 5199
```

> **El backend debe aceptar el origen que sirves.** El navegador solo puede llamar a la API desde los orígenes de `FRONTEND_URL`, y `backend/.env` trae `http://localhost:5173` (dotenv no pisa lo que ya esté en el entorno). Con el frontend en el puerto 5199, arranca el backend de prueba también con `FRONTEND_URL=http://localhost:5199` (`$env:FRONTEND_URL="http://localhost:5199"` / `FRONTEND_URL=http://localhost:5199 npm run dev`). Síntoma si falta: la pantalla de login falla con "No se pudo conectar con el servidor" y el log del backend dice `[CORS] Origen no permitido: http://localhost:5199`. `api.mjs` no necesita esto (no es un navegador).

Abre `http://localhost:5199/#/login` (las rutas son con hash: `/#/proveedores`), entra con `Admin` / `123456` y recorre la pantalla. Si tienes el navegador integrado (`mcp__Claude_Browser__*`) úsalo; si no, pide al usuario que lo haga con esta lista:

- [ ] Carga (skeleton) -> lista; vacío (busca algo inexistente); error (**apaga el backend** y recarga: tarjeta con "Reintentar" y mensaje en español; al volver el backend, "Reintentar" recupera).
- [ ] Crear (validación del formulario, error del servidor en el banner con el modal abierto, éxito = modal cerrado + toast + lista actualizada).
- [ ] Editar: datos precargados, vaciar un campo opcional se guarda, cambios se reflejan.
- [ ] Eliminar/desactivar: diálogo de confirmación; error de negocio visible; éxito con toast.
- [ ] Rol: entra también con un `WORKER` (créalo en Usuarios) y comprueba que no ve las acciones de admin **y que las que sí ve funcionan** (un 403 del servidor en una acción que la UI ofrece es un bug de la pantalla: compara el cuerpo que envía con lo que `roleMatrix.ts` admite al WORKER).
- [ ] Sesión: con un WORKER conectado, desactívalo desde la sesión del Admin (o reinicia el backend sin `JWT_SECRET` fijo) y haz una acción con el WORKER: debe volver a `/login` con un aviso ("Tu sesión expiró..." o, si fue desactivado, el texto del servidor) y, al volver a entrar, regresar a la pantalla donde estaba.
- [ ] Consola del navegador sin errores de React (hooks, keys) ni violaciones de `Content-Security-Policy`. Los 400/401/403 esperados de pruebas negativas son normales.
- [ ] Ancho de 768 px: sin scroll horizontal de la página.

Consejos para automatizar con el navegador integrado: **usa referencias de elementos** (`read_page` con `filter: interactive`) en vez de coordenadas, porque los banners de error mueven el layout; `F5` no recarga, usa `location.reload()` desde `javascript_tool`; los diálogos SweetAlert con título largo ocupan dos líneas y mueven el botón de confirmar; restablece el viewport a escritorio al terminar. Para saltarte el formulario de login hay que dejar en `sessionStorage` **las dos claves** (`masterfood_auth_token` con un token válido y `masterfood_auth_user` con el JSON del usuario); el token se obtiene con `api.mjs POST /api/auth/login ...` contra el backend de prueba. Solo con el usuario guardado y sin token, la app te manda al login.

## Peldaño 5 - Cierre

- Detén los servidores que levantaste (puertos 3055/5199) y borra BD temporales; no dejes archivos `.db` ni `dist/` en el árbol (están ignorados, pero no hay razón para generarlos).
- `git status` limpio de archivos inesperados; ningún `.env` ni credenciales en el diff.
- Resume lo que verificaste **y lo que no pudiste verificar** (p. ej. "no probé el rol WORKER").

## Qué hacer si algo falla

Corrige la causa en la capa donde nace (rara vez la UI) y repite el peldaño que falló. No silencies un aviso del preflight con un `// ignore`: si es un falso positivo, díselo al usuario o ajusta la regla en `scripts/preflight.mjs`.
