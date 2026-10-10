---
name: fullstack-new-module
description: Orquesta un módulo NUEVO de punta a punta (decisiones de negocio, BD, backend, frontend, ruta y menú, verificación y commits) delegando en las skills backend-* y frontend-*. Úsala SIEMPRE que pidan crear o agregar un módulo, sección, pantalla con su API o funcionalidad completa nueva (proveedores, compras, gastos, clientes, mesas, reportes...), aunque solo mencionen una de las capas.
---

# Módulo nuevo, de punta a punta

Un módulo completo toca cinco sitios que deben quedar de acuerdo entre sí: **esquema de BD, API, servicios del frontend, pantalla y navegación**. Esta skill fija el orden, las decisiones que hay que tomar antes de escribir y la verificación final; el detalle de cada capa vive en las skills específicas. Orden = de lo que otros consumen hacia lo que consume (BD -> backend -> frontend), porque así puedes probar cada capa con la anterior ya funcionando.

## 0. Antes de escribir: decisiones (pregunta solo lo que no se pueda deducir)

| Decisión | Opciones habituales | Efecto |
|---|---|---|
| Entidad y campos | nombre, tipos, únicos, obligatorios, relaciones | modelo Prisma + migración + validaciones + formulario |
| Permisos de UI | todos operan / todos leen y admin escribe / solo admin | `ProtectedRoute adminOnly`, `isAdmin` en botones, ítem del menú |
| ¿Mueve inventario? | sí/no | movimientos de Kardex en transacción (`backend-transactions-kardex`) |
| ¿Mueve dinero del turno? | sí/no | exige caja abierta y `cashSessionId` (`fullstack-domain-reference/references/cash-register.md`) |
| ¿Documento con código? | `COM-2026-0001`... | correlativo + `@unique` |
| ¿Borrar o desactivar? | si tiene historial: baja lógica | campo `active` en vez de `DELETE` |
| ¿Excel? | plantilla / reporte / carga masiva | `backend-excel-import-export` + `frontend-excel-import-export` |
| ¿KPI en el dashboard? | sí/no | `fullstack-modify-module` (recetas "KPI") |

Si el negocio no está claro (permisos, qué pasa con el stock), **pregunta** antes de implementar: son decisiones de producto, no técnicas. Para lo demás aplica los valores por defecto del proyecto y dilo en el resumen.

## 1. Convención de nombres (una sola vez, úsala en todas las capas)

| Concepto | Ejemplo "Proveedores" |
|---|---|
| Modelo / tabla | `Supplier` / `suppliers` |
| Backend (archivos) | `supplier.{routes,controller,service}.ts` |
| URL de la API | `/api/suppliers` |
| Carpeta del frontend | `frontend/src/app/suppliers/` |
| Archivos frontend | `SuppliersPage.jsx`, `SupplierModal.jsx`, `supplierService.js`, `SUPPLIER_ENDPOINTS` |
| Ruta de la pantalla / menú | `/proveedores` / "Proveedores" |

## 2. Secuencia

1. **Esquema y migración** -> skill `backend-db-migration` (modelo en `schema.prisma` + migración `00N_` en `init.ts` + `db:generate`). Prueba con `db-check.mjs`.
2. **Backend** -> `backend-new-module` (service, controller, routes, registro). Añade `backend-transactions-kardex` si hay documentos/stock/caja y `backend-excel-import-export` si hay Excel. Prueba cada endpoint con `api.mjs` (feliz, 400, 404).
3. **Contrato**: actualiza `fullstack-domain-reference/references/api-endpoints.md` y `data-model.md` ahora, mientras lo tienes fresco.
4. **Frontend**: `frontend-api-service` (endpoints + service) -> `frontend-new-feature` (carpeta, página, ruta, menú) apoyándote en `frontend-data-views`, `frontend-modal-form`, `frontend-design-system`, `frontend-alerts-dialogs` y `frontend-excel-import-export`.
5. **Cableado extra** si aplica: tarjeta/KPI del dashboard, enlaces desde otras pantallas, tipos de datos compartidos (p. ej. nuevos valores de enum en mapas de etiquetas).
6. **Verificación** -> `fullstack-verify-changes` (typecheck, build, drift esquema/migraciones, convenciones, prueba en navegador).
7. **Commits** -> `fullstack-git-commit`: uno por capa (BD+backend, luego frontend) y otro para la documentación/skills.

Si el usuario solo pide una capa (p. ej. "solo el endpoint"), haz esa capa completa y menciona qué falta de las demás.

## 3. Prueba de integración final (obligatoria)

Con backend (`npm run dev` en `backend/`) y frontend (`npm run dev` en `frontend/`) corriendo, entra con un usuario `ADMIN` y otro `WORKER` y recorre: lista vacía -> crear -> aparece en la lista -> editar (incluyendo vaciar un campo opcional) -> validación (campo obligatorio vacío, duplicado) -> eliminar/desactivar con confirmación -> recargar la página -> detener el backend y comprobar el estado de error con "Reintentar". Si hay herramientas de navegador disponibles, úsalas para hacerlo y comprobar la consola sin errores.

## 4. Entregable

Resume al usuario: qué se creó (archivos por capa), decisiones tomadas por defecto, cómo probarlo, y los avisos pendientes (p. ej. "la restricción de rol es solo de interfaz", "requiere copiar el `.db` antes de desplegar"). No hagas commit salvo que lo pida.

## Terminado cuando

- [ ] BD: schema y migración coinciden; `db-check.mjs` pasa en BD vacía y sobre una copia de la real.
- [ ] Backend: compila, endpoints probados, documentados.
- [ ] Frontend: ruta + menú + 3 estados + roles + build limpio.
- [ ] `preflight.mjs` sin hallazgos nuevos y prueba de integración hecha con ambos roles.
- [ ] Referencias de `fullstack-domain-reference` actualizadas.
