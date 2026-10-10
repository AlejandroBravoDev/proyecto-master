---
name: fullstack-modify-module
description: Actualizaciones de un módulo YA existente - agregar, quitar o renombrar un campo, filtro, endpoint, KPI del dashboard, enum, regla de negocio o columna de Excel - con la matriz de qué archivos tocar en BD, backend y frontend. Úsala SIEMPRE que pidan "agrega X a un módulo", "cambia/modifica/actualiza", "quita", "ahora también debe...", o corrijan un comportamiento ya implementado, antes de editar.
---

# Modificar un módulo existente (matriz de impacto)

Los cambios pequeños fallan porque se actualiza una capa y se olvidan las otras (campo nuevo que el modal no envía, columna que no existe en la BD de producción, etiqueta de enum sin traducir). Antes de editar, **busca todos los usos** y recorre la receta que corresponde; luego verifica con `fullstack-verify-changes`.

## Paso 0: mapa de usos

Busca (herramienta Grep) en `backend/src`, `backend/prisma`, `frontend/src` y `.claude/skills/fullstack-domain-reference` el nombre del campo en `camelCase` **y** `snake_case`, la ruta (`/api/...`) y el nombre del enum o de uno de sus valores. Léelo todo antes de cambiar nada: ahí aparecen plantillas Excel, seeds, mapas de etiquetas y textos de UI que dependen de lo que vas a tocar.

## Recetas

### A. Agregar un campo a una entidad
1. `schema.prisma`: campo con `@map`; en columnas obligatorias de tabla existente define `@default`.
2. **Migración nueva** (`ALTER TABLE ... ADD COLUMN`, nullable o con DEFAULT, con comprobación `PRAGMA table_info`) -> `backend-db-migration`. Backfill si hace falta.
3. `npm run db:generate`.
4. Service: incluirlo en `create`/`update` (y en `select` explícitos como los de `user.service.ts`). Controller: leer de `req.body ?? {}`, validar tipo/rango, pasar al service.
5. Excel (si el módulo importa/exporta): columna en plantilla, reporte e importación (`backend-excel-import-export`).
6. Frontend: service (sin cambios si envía el objeto completo), estado + input + validación + payload en el modal (`null` para poder limpiarlo), columna/tarjeta/badge en la vista, `utils` (etiquetas, formateo).
7. `seed.ts` / `init.ts` si los datos de ejemplo deben incluirlo; `data-model.md` y `api-endpoints.md`.

### B. Quitar o renombrar un campo (cambio rompiente)
Avisa al usuario y haz copia del `.db`. `RENAME COLUMN` / `DROP COLUMN` en una migración nueva (o reconstrucción de tabla si hay restricciones), actualiza Prisma, services, controllers, Excel, seeds, frontend y documentación **en el mismo cambio**. No dejes el nombre viejo "por compatibilidad" salvo que existan clientes externos.

### C. Agregar un filtro o búsqueda
- Backend: parámetro en `req.query` (`String()`/`Number()`, nunca asignar a `req.query`), `where` dinámico en el service (`Prisma.XWhereInput`), documentar. Si es solo de UI y la lista ya viene completa, **filtra en el cliente** con `useMemo` (`frontend-data-views`) y no toques el backend.
- Frontend: control en la header card, estado en la página, reinicio de paginación a 1, y si se usa desde otra pantalla, parámetro en la URL (`useSearchParams`).

### D. Agregar un endpoint a un módulo existente
Service -> controller -> ruta (**estáticas antes de `/:id`**) -> documentar (`backend-new-module`, variante A) -> `endpoints.js` + función de service (`frontend-api-service`) -> acción en la UI.

### E. Agregar un valor a un enum
`schema.prisma` + `db:generate` (sin DDL: se guarda como TEXT) -> uniones de tipos escritas a mano en services -> validaciones de allow-list en controllers -> frontend: mapas de etiquetas/badges (`REASON_LABELS`, `PRODUCT_TYPES`, estados de caja...), selects y filtros. Busca el nombre de otro valor del mismo enum para encontrar todos los sitios.

### F. Agregar un KPI al dashboard
`dashboard.service.ts#getKpis` (calcula con datos reales, redondeo `toFixed(2)`) -> respuesta de `GET /api/dashboard/kpis` -> `dashboardService.js` (nuevo objeto en `cards`) -> `MetricCard` (icono/formato si es un tipo nuevo). No muestres cifras que no calcule el backend. Ojo: `dashboard/services/endpoints.js` tiene un bug de URL conocido (`known-issues.md` B3); si lo tocas, usa `getApiBaseUrl()`.

### G. Cambiar una regla de negocio
Localiza **el único service** donde vive (ver `fullstack-domain-reference`), cambia ahí; ajusta el mapeo de errores del controller y el texto que ve el usuario (incluidos los `confirmDialog` que describían la regla vieja); evalúa datos existentes (¿hace falta migración o backfill?); actualiza la referencia de dominio.

### H. Cambiar permisos de rol
Solo UI: `ProtectedRoute adminOnly`, `isAdmin` en botones, Sidebar. Recuerda al usuario que el servidor no valida roles (`users-roles.md`).

### I. Pasar de paginación en cliente a servidor
Backend con `limit/page` + `{ total, page, limit, totalPages, items }`, frontend deja de rebanar con `slice`, usa `Pagination` con `totalItems = total` y llama de nuevo al servicio al cambiar de página/filtro.

### J. Bug en un flujo existente
Reprodúcelo primero (API con `api.mjs` o la UI); corrige en la capa donde nace (rara vez es la UI); añade el caso al checklist de la skill correspondiente si es un error repetible.

## Reglas de oro

- **Un cambio de esquema siempre implica migración** (la BD de producción no se actualiza sola).
- **Un cambio de contrato siempre implica actualizar ambos lados y la referencia** (`api-endpoints.md`).
- No arregles "de paso" problemas ajenos al pedido (`known-issues.md`); propónlos aparte.
- Mantén el estilo del archivo que editas; las plantillas de las skills son para código nuevo.
- Cambios destructivos (borrar columnas/datos, reconstruir tablas): avisa y pide copia del `.db`.

## Terminado cuando

- [ ] Todos los usos encontrados en el paso 0 fueron revisados (BD, backend, Excel/seed, frontend, documentación).
- [ ] Migración creada si el esquema cambió (`db-check.mjs` pasa).
- [ ] `fullstack-verify-changes` sin hallazgos nuevos, y el flujo probado de punta a punta.
- [ ] Referencias actualizadas (`api-endpoints.md`, `data-model.md`, reglas de dominio si cambiaron).
