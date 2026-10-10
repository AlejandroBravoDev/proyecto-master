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
3. **Routes** `backend/src/routes/<x>.routes.ts`: solo mapea verbo + path a un método del controller (sin lógica).
4. **Registro** en `backend/src/routes/index.ts`: `import xRoutes from './x.routes'` y `router.use('/xs', xRoutes)`.
5. **Compilar y probar**: `cd backend && npx tsc --noEmit`; levanta `npm run dev` y prueba cada endpoint con `node .claude/skills/fullstack-verify-changes/scripts/api.mjs` (camino feliz, 400 y 404).
6. **Documentar** el contrato en `.claude/skills/fullstack-domain-reference/references/api-endpoints.md` (y el modelo en `data-model.md`).

Las plantillas completas (con un módulo "Supplier" de ejemplo) están en `references/templates.md`: copia, renombra y ajusta; no las reescribas de memoria.

## 3. Reglas del proyecto y su porqué

**Respuestas**
- Éxito: JSON crudo (objeto o array), `201` al crear. Borrado: `{ message: 'X eliminado correctamente' }`. Sin envoltorio `{ success, data }` (el frontend no lo espera).
- Error: `{ error: 'mensaje en español' }`. En 500 añade `details: error.message` - **nunca** `details: error` completo: filtra internals de Prisma/SQLite (comprobado con un borrado que viola una FK).

**Códigos HTTP y errores**

| Situación | Cómo detectarla | Respuesta |
|---|---|---|
| Dato de entrada faltante o inválido | validación en el controller | 400 |
| Duplicado único | `error.code === 'P2002'` | 400 |
| No existe en update/delete | `error.code === 'P2025'` | 404 |
| No existe en get | service devuelve `null` | 404 |
| Regla de negocio | `error.message === 'CODIGO'` (con parámetro: `startsWith('CODIGO:')` y `split(':')[1]`) | 400 (404 si es "no encontrado") |
| Violación de FK (`P2003`) al borrar o al crear con una referencia inexistente | en delete: 400 "tiene registros asociados, desactívalo en su lugar"; en create: valida antes que las referencias existan (error de dominio) y como red de seguridad mapea `P2003` a 400 | 400 |
| Cualquier otro | catch final | 500 |

**Express 5**
- `req.params.id` es string: `Number(...)` y rechaza con 400 si `!Number.isInteger(id)`. Sin esa guarda, un id como `abc` llega a Prisma y devuelve 500.
- `req.body` es `undefined` si el cliente no manda JSON: desestructura `req.body ?? {}`. Sin ello, un POST vacío da 500 en vez de 400.
- `req.query` es un getter que se vuelve a parsear en cada acceso: **asignarle valores no tiene efecto**. Lee a variables locales (`String(req.query.x)`, `Number(...)`).
- Express 5 reenvía promesas rechazadas al manejador de errores, por lo que `asyncHandler` no hace falta; aun así los controllers capturan sus errores para traducirlos a mensajes útiles.

**Rutas**
- Usa funciones flecha `(req, res) => controller.metodo(req, res)`: los métodos son de clase y pasarlos sueltos pierde `this`.
- Registra las rutas **estáticas antes de `/:id`** (`/template/x`, `/export/x`, `/history`); si no, `/:id` las captura.
- Un archivo de rutas por módulo; el controlador no importa nada de `routes`.

**Datos**
- Validación en el controller, antes del service (no uses `express-validator`: está instalado pero el proyecto no lo usa). Recorta strings (`trim()`), comprueba `typeof`, `Number.isFinite`, y valores de enum permitidos.
- Actualizaciones parciales: pasa al service solo lo recibido. En el service, `undefined` = "no tocar la columna"; `null` = "limpiarla". El frontend necesita poder limpiar campos opcionales.
- Dinero: `Number(x.toFixed(2))` antes de guardar o sumar.
- Filtros tipados: `const where: Prisma.XWhereInput = {}` (`import { Prisma } from '@prisma/client'`) en vez de `any`. `contains` en SQLite no distingue mayúsculas para ASCII.
- Operaciones sobre varias tablas -> `prisma.$transaction(async (tx) => ...)` usando `tx` dentro (skill `backend-transactions-kardex`).
- Entidades referenciadas por documentos históricos (productos, insumos, usuarios): prefiere baja lógica (`active`/`available`) a `delete`.

**Seguridad**: el backend no autentica; no existe `req.user`. Si el endpoint es sensible (cambiar contraseñas, borrar datos, dinero), dilo al usuario en vez de asumir protección. Detalle en `fullstack-domain-reference/references/users-roles.md`.

**Estilo**: comentarios en español, con el banner `====` al inicio del archivo y JSDoc corto por método (`GET /api/x` + qué hace), igual que los módulos existentes.

## 4. Variantes

- **Endpoint nuevo en un módulo existente**: añade método al service, método al controller, línea en `routes` (cuidando el orden) y documenta. No crees archivos nuevos.
- **Reporte / solo lectura** (estilo dashboard): el service agrega y devuelve un objeto plano; el controller mantiene el mismo `try/catch` estándar (no uses `next(error)` como `dashboard.controller.ts`).
- **Paginación en servidor**: `limit`/`page` -> `skip`/`take` + `count` en `Promise.all`; responde `{ total, page, limit, totalPages, <items> }` (la forma de `GET /api/caja/history`). Ver plantilla.
- **Excel**: skill `backend-excel-import-export`. **Documento con detalle y/o stock**: skill `backend-transactions-kardex`.

## 5. Terminado cuando

- [ ] `npx tsc --noEmit` sin errores en `backend/`.
- [ ] Cada endpoint probado: camino feliz, body vacío (400), id inválido (400), id inexistente (404), duplicado (400) si aplica.
- [ ] Módulo registrado en `routes/index.ts` y migración creada si hubo cambio de esquema.
- [ ] `api-endpoints.md` (y `data-model.md`) actualizados.
- [ ] `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs` sin hallazgos nuevos.
