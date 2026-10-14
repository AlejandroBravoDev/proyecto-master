---
name: backend-new-module
description: Crea o extiende un recurso REST del backend (Express 5 + TypeScript + Prisma) con service, controller, routes y registro en routes/index.ts siguiendo las convenciones reales del proyecto. Úsala SIEMPRE que pidan un módulo, CRUD, endpoint, ruta, controlador o servicio nuevo del backend, o agregar un endpoint a un módulo existente, aunque no mencionen archivos ni capas.
---

# Backend: módulo nuevo o endpoint nuevo

Un módulo del backend son **tres archivos** (`routes` -> `controller` -> `service`) enchufados al router maestro. Respetar esta forma al pie de la letra importa porque el frontend depende de ella: espera JSON crudo en éxito y `{ error }` en fallo, y los mensajes de error se muestran tal cual al usuario.

## 1. Decide los nombres primero

| Concepto | Regla | Ejemplo (proveedores) |
|---|---|---|
| Modelo Prisma | PascalCase singular | `Supplier` |
| Tabla | plural snake_case (`@@map`) | `suppliers` |
| Archivos | `<singular>.routes.ts`, `.controller.ts`, `.service.ts` | `supplier.service.ts` |
| Clase / instancia | `SupplierService` / `supplierService` (singleton exportado) | |
| Prefijo de URL | plural en inglés kebab-case; si el término de dominio ya es español, se mantiene (`/caja`) | `/api/suppliers` |
| Métodos service | `getAllX`, `getXById`, `createX`, `updateX`, `deleteX` | |

Si necesita **tabla o columna nueva**, corre primero la skill `backend-db-migration`: el esquema físico no se crea solo, y sin migración el módulo funciona en tu BD pero falla en cualquier BD nueva.

## 2. Pasos

1. **Service** `backend/src/services/<x>.service.ts`: clase con métodos que usan `prisma` (`import prisma from '../prisma/client'`). Aquí viven las reglas de negocio. Nunca toca `req`/`res`. Ante una regla violada lanza `new Error('CODIGO_EN_MAYUSCULAS')`.
2. **Controller** `backend/src/controllers/<x>.controller.ts`: parsea `req`, valida entrada básica, llama al service y traduce errores a HTTP. Un `try/catch` por método.
3. **Routes** `backend/src/routes/<x>.routes.ts`: solo mapea verbo + path a un método del controller (sin lógica), más `router.param('id', validateIdParam)` y la **guardia de rol** de cada ruta (ver "Seguridad").
4. **Registro** en `backend/src/routes/index.ts`: `import xRoutes from './x.routes'` y `router.use('/xs', xRoutes)`, **debajo de `router.use(authenticate)`** (así exige token). Si todo el módulo es solo ADMIN: `router.use('/xs', requireRole('ADMIN'), xRoutes)`.
5. **Matriz de roles**: declara cada ruta nueva en `backend/tests/helpers/roleMatrix.ts` (`worker: 'allow' | 'deny'`). La prueba-guardia `auth-route-guard.test.ts` falla si una ruta registrada no está ahí.
6. **Compilar y probar**: `cd backend && npx tsc --noEmit`; levanta el backend aislado (ver `fullstack-verify-changes`) y prueba cada endpoint con `node .claude/skills/fullstack-verify-changes/scripts/api.mjs` (inicia sesión sola; camino feliz, 400, 404 y 403 con `--as <un WORKER>`); y escribe la prueba de integración (`backend-testing`).
7. **Documentar** el contrato en `.claude/skills/fullstack-domain-reference/references/api-endpoints.md` (y el modelo en `data-model.md`, y la tabla de roles de `users-roles.md`).

Las plantillas completas (con un módulo "Supplier" de ejemplo) están en `references/templates.md`: copia, renombra y ajusta; no las reescribas de memoria.

## 3. Reglas del proyecto y su porqué

**Respuestas**
- Éxito: JSON crudo (objeto o array), `201` al crear. Borrado: `{ message: 'X eliminado correctamente' }`. Sin envoltorio `{ success, data }` (el frontend no lo espera).
- Error: `{ error: 'mensaje en español' }`. En 500 añade `details: errorDetails(error)` (helper de `utils/http.utils.ts`: devuelve siempre **texto**, y sustituye los errores de Prisma por uno genérico) - **nunca** `details: error`: filtraba internals de Prisma/SQLite (el preflight lo avisa como `BE-DETAILS-OBJECT`).

**Códigos HTTP y errores**

| Situación | Cómo detectarla | Respuesta |
|---|---|---|
| Sin token, token inválido o vencido | `authenticate` (ya montado en el router maestro) | 401 con `code` (no lo escribes tú) |
| Rol sin permiso | `requireRole` / `requireAdminOrFields` en la ruta, o regla por turno/dueño en el controller con `sendForbidden(res)` | 403 `{ error: 'No tienes permisos para realizar esta acción.' }` |
| Dato de entrada faltante o inválido | validación en el controller | 400 |
| Duplicado único | `error.code === 'P2002'` | 400 |
| No existe en update/delete | `error.code === 'P2025'` | 404 |
| No existe en get | service devuelve `null` | 404 |
| Regla de negocio | `error.message === 'CODIGO'` (con parámetro: `startsWith('CODIGO:')` y `split(':')[1]`) | 400 (404 si es "no encontrado") |
| Violación de FK (`P2003`) al borrar o al crear con una referencia inexistente | en delete: 400 "tiene registros asociados, desactívalo en su lugar"; en create: valida antes que las referencias existan (error de dominio) y como red de seguridad mapea `P2003` a 400 | 400 |
| Cualquier otro | catch final | 500 |

**Express 5**
- `req.params.id` es string. Registra `router.param('id', validateIdParam)` (y uno por cada otro parámetro de id, p. ej. `'productId'`) en el archivo de rutas: un id que no sea entero positivo responde 400 `{ error: 'ID inválido' }` antes de llegar al controller, y allí basta `Number(req.params.id)`. Para ids de **query** o del body usa `parseId(...)` (devuelve `null` si no es válido -> 400). Sin esa guarda, un id como `abc` llegaba a Prisma y devolvía 500.
- `req.body` es `undefined` si el cliente no manda JSON (`ensureBody` en `app.ts` ya lo deja en `{}`, pero el preflight sigue exigiendo el patrón): desestructura `req.body ?? {}`. JSON malformado -> 400 y cuerpo mayor de 100 kb -> 413 los responde el manejador global.
- `req.query` es un getter que se vuelve a parsear en cada acceso: **asignarle valores no tiene efecto**. Lee a variables locales (`String(req.query.x)`, `Number(...)`).
- Express 5 reenvía promesas rechazadas al manejador de errores, por lo que `asyncHandler` no hace falta; aun así los controllers capturan sus errores para traducirlos a mensajes útiles.

**Rutas**
- Usa funciones flecha `(req, res) => controller.metodo(req, res)`: los métodos son de clase y pasarlos sueltos pierde `this`.
- Registra las rutas **estáticas antes de `/:id`** (`/template/x`, `/export/x`, `/history`); si no, `/:id` las captura.
- Un archivo de rutas por módulo; el controlador no importa nada de `routes`.

**Datos**
- Validación en el controller, antes del service, con los helpers de `utils/http.utils.ts` (no hay `express-validator`: se retiró de las dependencias): `parseRequiredText` (texto obligatorio recortado; en blanco -> `null` -> 400), `parseOptionalText` (opcional que se puede limpiar), `toFiniteNumber`, `parseOptionalNumber`, `parseId`. Comprueba además los valores de enum permitidos y los booleanos estrictos (`typeof x === 'boolean'`).
- Actualizaciones parciales: pasa al service solo lo recibido. En el service, `undefined` = "no tocar la columna"; `null` = "limpiarla" (`parseOptionalText` ya lo da resuelto: `null` o `''` -> `null`). El frontend necesita poder limpiar campos opcionales.
- Dinero: `Number(x.toFixed(2))` antes de guardar o sumar.
- Filtros tipados: `const where: Prisma.XWhereInput = {}` (`import { Prisma } from '@prisma/client'`) en vez de `any`. `contains` en SQLite no distingue mayúsculas para ASCII.
- Operaciones sobre varias tablas -> `prisma.$transaction(async (tx) => ...)` usando `tx` dentro (skill `backend-transactions-kardex`).
- Entidades referenciadas por documentos históricos (productos, insumos, usuarios): prefiere baja lógica (`active`/`available`) a `delete`.

**Seguridad** (el servidor autentica y autoriza; detalle en `fullstack-domain-reference/references/users-roles.md`):
- Todo `/api` salvo el login exige token: una ruta montada debajo de `router.use(authenticate)` ya lo exige, y `req.user` (`{ id, username, fullName, role }`) está disponible en el controller. **Nunca** tomes el usuario del body (la caja ignora el `userId` que envíe el cliente): usa `req.user.id`.
- **Decide el rol de cada ruta al crearla** (pregunta al usuario si el negocio no lo deja claro): `requireRole('ADMIN')` para solo admin, `requireAdminOrFields('campo', ...)` si el trabajador solo puede tocar ciertos campos, o ninguna guardia si cualquier usuario autenticado puede. **Una ruta sin guardia queda abierta a cualquier usuario autenticado**, así que esa decisión es explícita.
- **Añade la ruta a `backend/tests/helpers/roleMatrix.ts`**: la prueba-guardia (`auth-route-guard.test.ts`) recorre todas las rutas registradas y **falla** si alguna no está declarada (o si sobra una entrada), y `auth-roles.test.ts` comprueba la matriz contra el servidor con un WORKER y un ADMIN.
- Si el endpoint mueve dinero, borra datos o cambia contraseñas, valora si el WORKER debe poder usarlo; si la UI se lo ofrece al trabajador y decides no restringirlo, deja la recomendación en `known-issues.md` (como R1..R4).

**Estilo**: comentarios en español, con el banner `====` al inicio del archivo y JSDoc corto por método (`GET /api/x` + qué hace), igual que los módulos existentes.

## 4. Variantes

- **Endpoint nuevo en un módulo existente**: añade método al service, método al controller, línea en `routes` (cuidando el orden) y documenta. No crees archivos nuevos.
- **Reporte / solo lectura** (estilo dashboard): el service agrega y devuelve un objeto plano; el controller mantiene el mismo `try/catch` estándar (no uses `next(error)` como `dashboard.controller.ts`).
- **Paginación en servidor**: `parsePagination(req.query, { defaultLimit, maxLimit })` (`undefined` = sin paginar y se devuelve la lista completa; `null` = parámetros inválidos -> 400) -> `skip`/`take` + `count` en `Promise.all`; responde `{ total, page, limit, totalPages, <items> }` (la forma de `GET /api/users`, `/api/caja/history` y `/api/inventory/movements`). Ver plantilla.
- **Excel**: skill `backend-excel-import-export`. **Documento con detalle y/o stock**: skill `backend-transactions-kardex`.

## 5. Terminado cuando

- [ ] `npx tsc --noEmit` sin errores en `backend/`.
- [ ] Cada endpoint probado: camino feliz, body vacío (400), id inválido (400), id inexistente (404), duplicado (400) si aplica, sin token (401) y con un WORKER donde corresponda (403).
- [ ] Módulo registrado en `routes/index.ts` (debajo de `authenticate`), cada ruta con su guardia de rol **y declarada en `roleMatrix.ts`**, y migración creada si hubo cambio de esquema.
- [ ] `api-endpoints.md` (y `data-model.md`, y la tabla de roles de `users-roles.md`) actualizados.
- [ ] `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` sin hallazgos nuevos.
