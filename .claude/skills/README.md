# Skills de MasterFood POS

Una sola carpeta (`.claude/skills/`, la ubicación que Claude Code descubre automáticamente), con **19 skills** agrupadas por prefijo: `backend-*`, `frontend-*` y `fullstack-*` (lo que abarca ambas capas o todo el repo). Cada skill es un proceso que se repite al crear un módulo o actualizar uno existente. Claude las activa solo según su `description`; también puedes invocarlas a mano (`/backend-new-module`).

> Sustituyen a las skills antiguas de `.agents/skills/` y `frontend/.agent/skills/` (obsoletas: hablaban de `better-sqlite3` + CommonJS y de Electron, y no cubrían migraciones, modales, listados ni despliegue). Siguen en el historial de git si necesitas consultarlas.

> **Recarga**: Claude Code carga `.claude/skills/` al iniciar la sesión. Si la carpeta se creó o cambió de sitio con una sesión ya abierta, abre una sesión nueva para que las reconozca (el contenido de skills ya cargadas sí se actualiza en caliente). Comprobación rápida: pregunta "¿qué skills del proyecto tienes?" o escribe `/` y busca `backend-`, `frontend-`, `fullstack-`.

## Índice

### Backend
| Skill | Para qué |
|---|---|
| `backend-new-module` | service + controller + routes + registro de un recurso REST nuevo, o un endpoint nuevo en uno existente; **decidir su rol y declararlo en `roleMatrix.ts`** |
| `backend-db-migration` | cambios de BD: `schema.prisma` + migración manual en `init.ts` (+ `MIGRATION_IDS`; no se usa `prisma migrate`) + seed |
| `backend-transactions-kardex` | operaciones atómicas: `$transaction`, correlativos (`ORD-`/`INV-`/`CAJA-`), movimientos de Kardex, validación previa de stock y devolución, caja abierta |
| `backend-excel-import-export` | plantilla, reporte y carga masiva `.xlsx` (exceljs + multer), con el patrón async correcto |
| `backend-testing` | pruebas de integración HTTP (Jest + supertest + SQLite temporal), sesión JWT y roles (`useTestApp`), Excel, transacciones y regresiones de bugs corregidos |

### Frontend
| Skill | Para qué |
|---|---|
| `frontend-new-feature` | carpeta de feature, página, ruta en `router.jsx`, ítem del Sidebar, roles |
| `frontend-api-service` | `endpoints.js` + services sobre la capa HTTP única `config/apiFetch.js` (`requestJson`/`requestBlob`): token, 401/403 y errores en español (`getApiBaseUrl`) |
| `frontend-modal-form` | modal de crear/editar/detalle con anti doble envío y contrato `onSubmit` |
| `frontend-data-views` | tablas y grillas de tarjetas con búsqueda, filtros, paginación y estados cargando/error/vacío |
| `frontend-design-system` | colores de marca, tipografía y recetas de clases Tailwind |
| `frontend-alerts-dialogs` | confirmaciones, errores y toasts con SweetAlert2 |
| `frontend-excel-import-export` | descarga de plantilla/reporte y modal de importación con arrastrar y soltar |
| `frontend-testing` | pruebas de utils, services (fetch simulado y token), modales, páginas con rol (`renderWithApp`/`signInAs`), sesión/401 y pruebas de estructura (Vitest + Testing Library) |

### Fullstack (transversales)
| Skill | Para qué |
|---|---|
| `fullstack-new-module` | **módulo nuevo de punta a punta**: decisiones, orden de capas, prueba de integración |
| `fullstack-modify-module` | **cambiar algo existente**: matriz de impacto (campo, filtro, endpoint, enum, KPI, regla, rol: el servidor valida) |
| `fullstack-verify-changes` | escalera de verificación + scripts `preflight`, `db-check`, `api` (inicia sesión sola), `check-skills` |
| `fullstack-release-deploy` | versionar, compilar, probar en modo producción, variables de entorno de producción (`NODE_ENV`, `JWT_SECRET`...), orden de publicación, backups, rollback |
| `fullstack-git-commit` | commits Conventional en inglés con los scopes reales del repo |
| `fullstack-domain-reference` | arquitectura, modelo de datos, catálogo de endpoints (con auth y roles), reglas de caja/Kardex/comandas/usuarios y problemas conocidos |

## Atajos: "quiero..." -> skill

| Quiero... | Empieza por |
|---|---|
| Crear un módulo completo (p. ej. proveedores) | `fullstack-new-module` |
| Agregar un campo / filtro / endpoint a algo que ya existe | `fullstack-modify-module` |
| Solo la API de algo nuevo | `backend-new-module` (+ `backend-db-migration` si hay tabla) |
| Solo la pantalla de algo nuevo | `frontend-new-feature` |
| Una compra/merma/devolución que mueva stock | `backend-transactions-kardex` |
| Entender cómo funciona la caja, el inventario, la sesión (JWT) y los roles | `fullstack-domain-reference` |
| Cambiar quién puede hacer qué (roles por ruta) | `fullstack-modify-module` (receta H) + `roleMatrix.ts` |
| Escribir o arreglar pruebas del backend / del frontend | `backend-testing` / `frontend-testing` |
| Comprobar que todo está bien antes de entregar | `fullstack-verify-changes` |
| Subir a producción | `fullstack-release-deploy` |

## Cómo encajan (módulo nuevo)

```
fullstack-new-module
 ├─ backend-db-migration ─> backend-new-module ─> (backend-transactions-kardex) (backend-excel-import-export)
 ├─ frontend-api-service ─> frontend-new-feature ─> frontend-data-views + frontend-modal-form
 │                             └─ frontend-design-system · frontend-alerts-dialogs · (frontend-excel-import-export)
 ├─ backend-testing · frontend-testing  (junto a cada capa, no al final)
 ├─ fullstack-verify-changes  (siempre al final)
 └─ fullstack-git-commit      (un commit por capa)
```

## Herramientas (`fullstack-verify-changes/scripts/`)

Se ejecutan con Node desde la raíz del repo y funcionan en PowerShell, cmd y Git Bash. No instalan nada.

| Script | Qué hace |
|---|---|
| `preflight.mjs` | typecheck del backend, build del frontend (carpeta temporal), deriva schema vs. migraciones, enrutado, convenciones y documentación; `--changed` limita los avisos a tus líneas |
| `db-check.mjs` | prueba las migraciones sobre una BD vacía o una **copia** de la tuya (idempotencia, integridad); nunca toca la BD real |
| `api.mjs` | cliente HTTP para probar endpoints sin pelear con comillas (`key=valor`, `--json`, `--upload`, `--out`); **inicia sesión sola** (`--as <usuario> --password`, `--token`, `--no-auth`) porque toda la API exige token |
| `check-skills.mjs` | linter de estas skills: frontmatter, tamaño, enlaces y archivos citados |

## Mantenimiento

- Las skills afirman hechos del código: cuando cambie una convención, actualiza la skill **en el mismo cambio**. Los hechos viven en `fullstack-domain-reference`; los procesos, en las demás.
- Después de editarlas: `node .claude/skills/fullstack-verify-changes/scripts/check-skills.mjs`.
- Las plantillas (código completo en `references/`) están validadas compilándolas contra el backend y el frontend reales. Si cambias una plantilla, vuelve a compilarla en una copia antes de darla por buena.
- Para añadir una skill: carpeta en minúsculas con prefijo `backend-` / `frontend-` / `fullstack-`, `SKILL.md` con `name` igual a la carpeta y una `description` que diga **qué hace y cuándo usarla** (con las frases que diría el usuario), cuerpo < 500 líneas y el detalle largo en `references/`. Explica el porqué de cada regla.
- `fullstack-domain-reference/references/known-issues.md` lista los problemas **abiertos** verificados del código actual (sesión, recomendaciones sobre el WORKER, bugs, inconsistencias, operación) y, al final, una línea por cada hallazgo resuelto el 2026-10-13. Si arreglas uno, bórralo de la lista (y añade, si merece memoria, su línea en "Resueltos").
- Cuando cambie un conteo de pruebas, un rol, una variable de entorno o el contrato de un endpoint, actualiza `docs/testing.md`, `users-roles.md`, `architecture.md` y `api-endpoints.md` en el mismo cambio.

## Otros agentes

Claude Code lee `.claude/skills/`. Si usas otra herramienta que espera `.agents/skills/` (o similar), copia o enlaza esta carpeta en lugar de duplicar contenido a mano; las skills son Markdown plano con frontmatter estándar (`name`, `description`).
