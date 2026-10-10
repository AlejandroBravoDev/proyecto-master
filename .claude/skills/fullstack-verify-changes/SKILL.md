---
name: fullstack-verify-changes
description: Verificación antes de dar por terminado cualquier cambio de código del POS - typecheck del backend, build del frontend, deriva entre schema.prisma y las migraciones, convenciones del proyecto, pruebas de la API (api.mjs) y recorrido en el navegador con ambos roles. Úsala SIEMPRE al terminar una tarea de código, antes de un commit o PR, y cuando pidan verificar, probar, "revisar que todo compile" o comprobar un flujo.
---

# Verificar cambios (la escalera de verificación)

"Compila" no es "funciona". Este proyecto no tiene tests automáticos ni linter, así que la verificación es un conjunto de comprobaciones manuales y scripts. Súbela peldaño a peldaño según lo que tocaste; cada uno detecta una clase distinta de fallo. Las herramientas están en `scripts/` (Node, sin dependencias nuevas, funcionan en PowerShell, cmd y Git Bash).

## Peldaño 1 - Preflight (siempre)

```bash
node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs            # todo
node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs --changed  # solo avisos en las líneas que tocaste
```

Hace: `tsc --noEmit` del backend, `vite build` del frontend a una carpeta temporal (no ensucia `frontend/dist`), compara `schema.prisma` con el SQL de las migraciones, comprueba que cada `*.routes.ts` y cada `*Page.jsx` esté registrado, escanea convenciones y revisa que las rutas y modelos estén documentados. Sale con código 1 si hay **errores**; los **avisos** (⚠) son consejos: úsalos con `--changed` para ver solo lo que añadiste tú, porque el repo ya arrastra avisos antiguos (`known-issues.md`).

| Regla | Nivel | Qué detecta y qué hacer |
|---|---|---|
| `DB-DRIFT` | error | un modelo/columna de `schema.prisma` no está en las migraciones -> `backend-db-migration` |
| `BE-ROUTE-UNREGISTERED` / `FE-ROUTE-MISSING` | error | ruta o página sin registrar en `routes/index.ts` / `router.jsx` |
| `FE-HOOK-AFTER-RETURN` | error | hook después de `if (!isOpen) return null` (rompe React) |
| `BE-PRISMA-IN-TX` | error | `prisma.` dentro de `$transaction(async (tx) => ...)`: usa `tx.` |
| `FE-NATIVE-DIALOG` | aviso | `window.confirm/alert/prompt` -> `frontend-alerts-dialogs` |
| `FE-ENV-DIRECT` | aviso | `import.meta.env.VITE_API_URL` fuera de `config/api.js` -> `getApiBaseUrl()` |
| `FE-HARDCODED-URL` / `FE-FETCH-OUTSIDE-SERVICE` | aviso | URL o `fetch` fuera de `services/` -> `frontend-api-service` |
| `FE-UNDEFINED-ANIMATION` | aviso | `animate-fade-in/slide-up/shake` sin definir (no hace nada) |
| `BE-DETAILS-OBJECT` | aviso | `details: error` filtra internals: `error.message` |
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
BD vacía y copia de tu BD real (nunca modifica la original); ejecuta `initializeDatabase()` dos veces, exige idempotencia, `integrity_check` y `foreign_key_check`, y lista tablas/migraciones.

## Peldaño 3 - API (si tocaste backend)

Levanta el backend **aislado** (no ensucia tu BD real ni choca con el puerto 3001):

```bash
# PowerShell (en backend/)
$env:SQLITE_DB_PATH="$env:TEMP\mf-test.db"; $env:SQLITE_BACKUP_DIR="$env:TEMP\mf-test-backups"; $env:PORT="3055"; npm run dev
# bash (en backend/)
SQLITE_DB_PATH=/tmp/mf-test.db SQLITE_BACKUP_DIR=/tmp/mf-test-backups PORT=3055 npm run dev
```

Y pruébalo con `api.mjs` (la BD de prueba arranca con datos de ejemplo y el usuario `Admin` / `123456`):

```bash
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 GET /api/categories
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 POST /api/suppliers name=Acme phone=555
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --url http://localhost:3055 POST /api/purchases --json "{supplierId:1,items:[{ingredientId:1,quantity:5,unitCost:0.6}]}"
node .../api.mjs --url ... POST /api/x/import/x --upload file=./archivo.xlsx   # multipart
node .../api.mjs --url ... GET /api/x/template/x --out plantilla.xlsx           # descarga binaria
```
(También `API_URL=http://localhost:3055` en vez de `--url`.) Devuelve código 0 en 2xx y 1 en otro caso. Para cada endpoint prueba: camino feliz, body vacío (400), id no numérico (400), id inexistente (404), duplicado (400), y si hay transacción, un fallo a mitad (nada debe quedar guardado). Comprueba en la respuesta que los mensajes estén en español.

## Peldaño 4 - UI (si tocaste frontend)

Con el backend aislado del peldaño 3, en `frontend/`:

```bash
# PowerShell
$env:VITE_API_URL="http://localhost:3055"; npm run dev -- --port 5199
# bash
VITE_API_URL=http://localhost:3055 npm run dev -- --port 5199
```
Abre `http://localhost:5199/#/login` (las rutas son con hash: `/#/proveedores`), entra con `Admin` / `123456` y recorre la pantalla. Si tienes el navegador integrado (`mcp__Claude_Browser__*`) úsalo; si no, pide al usuario que lo haga con esta lista:

- [ ] Carga (skeleton) -> lista; vacío (busca algo inexistente); error (**apaga el backend** y recarga: tarjeta con "Reintentar" y mensaje en español; al volver el backend, "Reintentar" recupera).
- [ ] Crear (validación del formulario, error del servidor en el banner con el modal abierto, éxito = modal cerrado + toast + lista actualizada).
- [ ] Editar: datos precargados, vaciar un campo opcional se guarda, cambios se reflejan.
- [ ] Eliminar/desactivar: diálogo de confirmación; error de negocio visible; éxito con toast.
- [ ] Rol: entra también con un `WORKER` (créalo en Usuarios) y comprueba que no ve ni puede usar las acciones de admin.
- [ ] Consola del navegador sin errores de React (hooks, keys). Los 400 esperados de pruebas negativas son normales.
- [ ] Ancho de 768 px: sin scroll horizontal de la página.

Consejos para automatizar con el navegador integrado: **usa referencias de elementos** (`read_page` con `filter: interactive`) en vez de coordenadas, porque los banners de error mueven el layout; `F5` no recarga, usa `location.reload()` desde `javascript_tool`; los diálogos SweetAlert con título largo ocupan dos líneas y mueven el botón de confirmar; restablece el viewport a escritorio al terminar.

## Peldaño 5 - Cierre

- Detén los servidores que levantaste (puertos 3055/5199) y borra BD temporales; no dejes archivos `.db` ni `dist/` en el árbol (están ignorados, pero no hay razón para generarlos).
- `git status` limpio de archivos inesperados; ningún `.env` ni credenciales en el diff.
- Resume lo que verificaste **y lo que no pudiste verificar** (p. ej. "no probé el rol WORKER").

## Qué hacer si algo falla

Corrige la causa en la capa donde nace (rara vez la UI) y repite el peldaño que falló. No silencies un aviso del preflight con un `// ignore`: si es un falso positivo, díselo al usuario o ajusta la regla en `scripts/preflight.mjs`.
