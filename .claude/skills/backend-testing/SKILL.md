---
name: backend-testing
description: Escribe y ejecuta pruebas automáticas del backend (Jest + ts-jest + supertest contra una SQLite temporal) - integración HTTP por módulo, sesión JWT y roles, pruebas unitarias de utils, Excel, transacciones y regresiones de bugs corregidos. Úsala SIEMPRE que se cree o cambie un endpoint, service, regla de negocio, rol o migración, o cuando pidan "tests", "pruebas", "cobertura", "que no se rompa", "TDD" o reproducir un bug del backend con una prueba.
---

# Backend: pruebas automáticas

El backend se prueba **por HTTP contra una BD real temporal** (no con mocks de Prisma): así se verifican a la vez ruta, controller, service, SQL y migraciones. Cada archivo de prueba arranca su propia SQLite, por eso corren en paralelo y nunca tocan `backend/prisma/dev.db`. Guía completa y estado (2026-10-13: 22 suites / 650 pruebas, todas en verde): `docs/testing.md`.

## Comandos (desde `backend/`)

```bash
npm test                              # toda la suite
npx jest tests/integration/caja       # un archivo (coincidencia parcial del nombre)
npx jest -t "cierra caja"             # una prueba por nombre
npm run test:coverage                 # cobertura de src/
npm run test:all                      # backend + frontend
```

## Cómo está montado (no lo rompas)

| Pieza | Para qué |
|---|---|
| `src/app.ts` | `createApp(options)` construye la app Express **sin** `listen()` leyendo el entorno en ese momento (`env`, `rateLimit`, `frontendDist`, `requestLogger` se pueden inyectar en pruebas); `export default` es la app real. `server.ts` solo arranca. Todo middleware/ruta global va en `app.ts` |
| `tests/setup/env.ts` | `setupFiles`: fija `NODE_ENV=test`, `SQLITE_DB_PATH`/`SQLITE_BACKUP_DIR` temporales, un `JWT_SECRET` de prueba y **vacía** las variables de seguridad (`FRONTEND_URL`, `TRUST_PROXY`, `RATE_LIMIT_*`...) para que un `backend/.env` local no cambie el resultado, todo **antes** de importar Prisma. Si importas `prisma/client` en un setup que corre antes, la BD apuntará a `dev.db` |
| `tests/helpers/testApp.ts` | `useTestApp()`: inicializa la BD, **inicia sesión como Admin** y devuelve `ctx.api` (cliente supertest que ya manda `Authorization: Bearer <token>`), `ctx.anon` (sin token), `ctx.adminToken`, `ctx.loginAs(usuario, clave)` y `ctx.createWorker()` (crea un WORKER activo y devuelve su sesión `{ api, token, user, username, password }`). Más: `clientWithToken(token)`, `rawLogin()`, `testJwtSecret()`, `idByName`, `openCaja`, `closeCaja`, `ADMIN` |
| `tests/helpers/roleMatrix.ts` | matriz **esperada** de roles por ruta (`ROLE_MATRIX`) y `concretePath()`: la usan `auth-roles` y la prueba-guardia `auth-route-guard` |
| `jest.config.js` / `tests/tsconfig.json` | ts-jest; las pruebas están fuera de `src/` para que `tsc` no las compile a `dist/` |

Como **toda** la API exige token (salvo `POST /api/auth/login`), nunca llames a `supertest(app)` a pelo en una prueba de un endpoint: usa `ctx.api`. Para probar sin sesión, `ctx.anon`; para otro rol, `ctx.createWorker()`.

La BD de prueba trae lo que siembra `initializeDatabase()`: usuario `Admin`/`123456` (solo fuera de producción); categorías Bebidas, Hamburguesas, Postres; insumos Pan de Hamburguesa (100), Carne de Res 150g (80), Lámina de Queso Cheddar (150); productos "Hamburguesa con Queso" (7.50, receta 1 pan + 1 carne + 2 queso), "Café Cappuccino" y "Gaseosa 350ml" (venta directa). **Busca por nombre** (`idByName`), nunca por id fijo, y no asumas que otro archivo dejó datos: cada archivo parte limpio.

## Qué hay cubierto (para no duplicar)

| Archivo (`tests/integration/`) | Qué fija |
|---|---|
| `auth-middleware`, `auth-roles`, `auth-route-guard` | JWT (token vencido, firma ajena, `alg: none`, usuario inactivo, cambio de contraseña), matriz de roles contra el servidor y el inventario de rutas |
| `security-rate-limit`, `security-cors-csp`, `security-body`, `security-admin-password` | límites de tasa (con `createApp({ rateLimit })`), CORS/CSP/trust proxy (con `createApp({ env })`), JSON inválido / cuerpo grande / body vacío, contraseña del Admin inicial |
| `ops-db-path`, `ops-startup` | ruta de la BD, copia `pre-migration-*`, fallo rápido de `bootstrapServer` |
| `catalog`, `ingredients-inventory`, `caja`, `orders-sales-dashboard`, `orders-stock`, `auth-users`, `health-and-init`, `known-issues` | los módulos y las regresiones de los bugs de la auditoría (B5-B10, T1/T2, I1/I2, S3) |
| `unit/` | `auth.utils`, `jwt.utils`, `http.utils`, `sequence.utils`, `recipe.utils` |

## Receta para un módulo nuevo

1. Crea `tests/integration/<modulo>.test.ts` con la plantilla de `references/test-templates.md`.
2. Cubre, como mínimo, por cada endpoint: **éxito**, **validación (400)** con body vacío/campos faltantes, **id inválido (400)** y **404** con id inexistente, **duplicado (400)** si hay `@unique`, la **forma** de la respuesta (campos que el frontend consume, sin `passwordHash` ni internals) y los **roles**: sin token (401, `ctx.anon`) y con un WORKER (`ctx.createWorker()`) lo que corresponda (403 si es solo admin).
3. Declara el rol de cada ruta en `tests/helpers/roleMatrix.ts`: `auth-route-guard` falla si una ruta registrada no está (o si sobra una entrada) y `auth-roles` la prueba con un WORKER y un ADMIN. Si el WORKER solo puede enviar ciertos campos, rellena `workerBody`.
4. Si el flujo es transaccional (`backend-transactions-kardex`): una prueba que falle **a mitad** y verifique que no quedó nada guardado (ni documento, ni movimiento de Kardex, ni stock cambiado), y otra que compruebe el Kardex (`type`, `reason`, `previousStock`, `newStock`, `reference`).
5. Si toca caja: abre/cierra con `openCaja`/`closeCaja` y deja la caja cerrada al terminar la historia.
6. Si importa/exporta Excel (`backend-excel-import-export`): arma el `.xlsx` en memoria con `exceljs` (ver plantilla) y comprueba el resumen `created/updated/skipped/errors`; `eachRow(async)` mal usado se nota porque el resumen llega incompleto.
7. Si añades una migración (`backend-db-migration`): `health-and-init.test.ts` ya comprueba idempotencia e integridad; añade ahí una aserción de la tabla/columna nueva con `better-sqlite3` en modo `readonly`.
8. Corre `npm test` y luego el preflight (`fullstack-verify-changes`).

## Reglas que ahorran horas

- **Orden dentro del archivo**: las pruebas de un `describe` comparten estado y corren en secuencia. Guarda ids en variables del `describe` y nombra las pruebas como una historia. Para independencia total, usa nombres únicos por prueba (`Tomate-${Date.now()}`), no `beforeEach` que reinicie la BD (es lento).
- **Reloj**: el cierre `LATE_CLOSED` depende del día calendario; no lo pruebes cruzando medianoche, usa `jest.useFakeTimers({ now })` solo si hace falta y restáuralo en `afterEach`.
- **Números**: todos los montos son `Float` (no hay `Decimal`), así que llegan como número JSON; aun así compara dinero con `toBeCloseTo(x, 2)` o con el valor redondeado para esquivar el ruido de coma flotante (`15.000000000000002`).
- **Texto de errores**: aserta el código HTTP y una palabra clave (`/caja/i`), no la frase completa, salvo que el mensaje sea parte del contrato con el frontend (`{ error }` de 401/403, `ID inválido`).
- **Configuración especial** (límites de tasa, CORS, `NODE_ENV`, CSP): no toques `process.env`; crea una app aparte con `createApp({ env, rateLimit, frontendDist: null, requestLogger: false })` (cada llamada trae un almacén de límites nuevo). Los límites por defecto con `NODE_ENV=test` son altísimos a propósito.
- **No uses `jest.mock` de Prisma** para probar endpoints: ocultaría exactamente lo que más falla (SQL, FK, transacciones). Reserva los mocks para dependencias externas (correo, HTTP saliente) o para forzar un fallo a mitad de transacción (ver `known-issues.test.ts`).
- **Descargas binarias** con supertest: `.buffer(true).parse(...)` (ver plantilla) para recibir un `Buffer`.
- **Subidas**: `.attach('file', buffer, { filename, contentType })`.
- **Cliente con token en el 401**: el token vencido o de otra clave se firma con `testJwtSecret()` y `jsonwebtoken` (ver `auth-middleware.test.ts`).

## Bugs: la prueba primero

Para un bug (de la auditoría o nuevo): escribe la prueba del comportamiento **correcto**, comprueba que falla, corrige y déjala como regresión (comentando el identificador, p. ej. `B5`). Todos los bugs de la auditoría ya están corregidos y sus pruebas son normales: **hoy no queda ningún `it.failing`**. Solo si encuentras un bug que no te toca arreglar (regla de `fullstack-modify-module`), no lo ocultes ni lo "normalices" en una aserción: escribe la prueba correcta con `it.failing(...)` (Jest avisa el día que pase) y regístralo en `fullstack-domain-reference/references/known-issues.md`; al corregirlo, quita `.failing` y borra la fila.

## Terminado cuando

- [ ] `npm test` en verde, sin pruebas `.skip`/`.only` olvidadas y sin `console.error` inesperados.
- [ ] Cada endpoint nuevo tiene éxito + 400 + 404 (+ duplicado/transacción si aplica) + 401 sin token + el 403 que corresponda a un WORKER.
- [ ] Las rutas nuevas están en `roleMatrix.ts`.
- [ ] Las pruebas no dependen de datos fuera de la semilla ni de ids fijos.
- [ ] `docs/testing.md` actualizado si cambió la estructura (archivo nuevo, helper nuevo) o los conteos.
