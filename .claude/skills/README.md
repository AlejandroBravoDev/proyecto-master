# Skills de MasterFood POS

Una sola carpeta (`.claude/skills/`, la ubicación que Claude Code descubre automáticamente), con **17 skills** agrupadas por prefijo: `backend-*`, `frontend-*` y `fullstack-*` (lo que abarca ambas capas o todo el repo). Cada skill es un proceso que se repite al crear un módulo o actualizar uno existente. Claude las activa solo según su `description`; también puedes invocarlas a mano (`/backend-new-module`).

> Sustituyen a las skills antiguas de `.agents/skills/` y `frontend/.agent/skills/` (obsoletas: hablaban de `better-sqlite3` + CommonJS y de Electron, y no cubrían migraciones, modales, listados ni despliegue). Siguen en el historial de git si necesitas consultarlas.

> **Recarga**: Claude Code carga `.claude/skills/` al iniciar la sesión. Si la carpeta se creó o cambió de sitio con una sesión ya abierta, abre una sesión nueva para que las reconozca (el contenido de skills ya cargadas sí se actualiza en caliente). Comprobación rápida: pregunta "¿qué skills del proyecto tienes?" o escribe `/` y busca `backend-`, `frontend-`, `fullstack-`.

## Índice

### Backend
| Skill | Para qué |
|---|---|
| `backend-new-module` | service + controller + routes + registro de un recurso REST nuevo, o un endpoint nuevo en uno existente |
| `backend-db-migration` | cambios de BD: `schema.prisma` + migración manual en `init.ts` (no se usa `prisma migrate`) + seed |
| `backend-transactions-kardex` | operaciones atómicas: `$transaction`, correlativos (`ORD-`/`INV-`/`CAJA-`), movimientos de Kardex, caja abierta |
| `backend-excel-import-export` | plantilla, reporte y carga masiva `.xlsx` (exceljs + multer), con el patrón async correcto |

### Frontend
| Skill | Para qué |
|---|---|
| `frontend-new-feature` | carpeta de feature, página, ruta en `router.jsx`, ítem del Sidebar, roles |
| `frontend-api-service` | `endpoints.js` + funciones `fetch` + manejo de errores (`getApiBaseUrl`, `safeFetch`) |
| `frontend-modal-form` | modal de crear/editar/detalle con anti doble envío y contrato `onSubmit` |
| `frontend-data-views` | tablas y grillas de tarjetas con búsqueda, filtros, paginación y estados cargando/error/vacío |
| `frontend-design-system` | colores de marca, tipografía y recetas de clases Tailwind |
| `frontend-alerts-dialogs` | confirmaciones, errores y toasts con SweetAlert2 |
| `frontend-excel-import-export` | descarga de plantilla/reporte y modal de importación con arrastrar y soltar |

### Fullstack (transversales)
| Skill | Para qué |
|---|---|
| `fullstack-new-module` | **módulo nuevo de punta a punta**: decisiones, orden de capas, prueba de integración |
| `fullstack-modify-module` | **cambiar algo existente**: matriz de impacto (campo, filtro, endpoint, enum, KPI, regla, rol) |
| `fullstack-verify-changes` | escalera de verificación + scripts `preflight`, `db-check`, `api`, `check-skills` |
| `fullstack-release-deploy` | versionar, compilar, probar en modo producción, variables de entorno, backups, rollback |
| `fullstack-git-commit` | commits Conventional en inglés con los scopes reales del repo |
| `fullstack-domain-reference` | arquitectura, modelo de datos, catálogo de endpoints, reglas de caja/Kardex/comandas/roles y problemas conocidos |

## Atajos: "quiero..." -> skill

| Quiero... | Empieza por |
|---|---|
| Crear un módulo completo (p. ej. proveedores) | `fullstack-new-module` |
| Agregar un campo / filtro / endpoint a algo que ya existe | `fullstack-modify-module` |
| Solo la API de algo nuevo | `backend-new-module` (+ `backend-db-migration` si hay tabla) |
| Solo la pantalla de algo nuevo | `frontend-new-feature` |
| Una compra/merma/devolución que mueva stock | `backend-transactions-kardex` |
| Entender cómo funciona la caja, el inventario, los roles | `fullstack-domain-reference` |
| Comprobar que todo está bien antes de entregar | `fullstack-verify-changes` |
| Subir a producción | `fullstack-release-deploy` |

## Cómo encajan (módulo nuevo)

```
fullstack-new-module
 ├─ backend-db-migration ─> backend-new-module ─> (backend-transactions-kardex) (backend-excel-import-export)
 ├─ frontend-api-service ─> frontend-new-feature ─> frontend-data-views + frontend-modal-form
 │                             └─ frontend-design-system · frontend-alerts-dialogs · (frontend-excel-import-export)
 ├─ fullstack-verify-changes  (siempre al final)
 └─ fullstack-git-commit      (un commit por capa)
```

## Herramientas (`fullstack-verify-changes/scripts/`)

Se ejecutan con Node desde la raíz del repo y funcionan en PowerShell, cmd y Git Bash. No instalan nada.

| Script | Qué hace |
|---|---|
| `preflight.mjs` | typecheck del backend, build del frontend (carpeta temporal), deriva schema vs. migraciones, enrutado, convenciones y documentación; `--changed` limita los avisos a tus líneas |
| `db-check.mjs` | prueba las migraciones sobre una BD vacía o una **copia** de la tuya (idempotencia, integridad); nunca toca la BD real |
| `api.mjs` | cliente HTTP para probar endpoints sin pelear con comillas (`key=valor`, `--json`, `--upload`, `--out`) |
| `check-skills.mjs` | linter de estas skills: frontmatter, tamaño, enlaces y archivos citados |

## Mantenimiento

- Las skills afirman hechos del código: cuando cambie una convención, actualiza la skill **en el mismo cambio**. Los hechos viven en `fullstack-domain-reference`; los procesos, en las demás.
- Después de editarlas: `node .claude/skills/fullstack-verify-changes/scripts/check-skills.mjs`.
- Las plantillas (código completo en `references/`) están validadas compilándolas contra el backend y el frontend reales. Si cambias una plantilla, vuelve a compilarla en una copia antes de darla por buena.
- Para añadir una skill: carpeta en minúsculas con prefijo `backend-` / `frontend-` / `fullstack-`, `SKILL.md` con `name` igual a la carpeta y una `description` que diga **qué hace y cuándo usarla** (con las frases que diría el usuario), cuerpo < 500 líneas y el detalle largo en `references/`. Explica el porqué de cada regla.
- `fullstack-domain-reference/references/known-issues.md` lista problemas verificados del código actual (seguridad, bugs, inconsistencias). Si arreglas uno, bórralo de la lista.

## Otros agentes

Claude Code lee `.claude/skills/`. Si usas otra herramienta que espera `.agents/skills/` (o similar), copia o enlaza esta carpeta en lugar de duplicar contenido a mano; las skills son Markdown plano con frontmatter estándar (`name`, `description`).
