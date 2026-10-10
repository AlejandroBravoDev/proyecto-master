---
name: backend-db-migration
description: Cambia la base de datos del backend - schema.prisma + migración SQLite incremental escrita a mano en src/prisma/init.ts (este proyecto NO usa prisma migrate) + datos iniciales/seed. Úsala SIEMPRE que se agregue, renombre o elimine una tabla, modelo, campo, índice o enum persistido, o que el usuario hable de migración, esquema, "agregar columna" o "que también guarde X", aunque no mencione la base de datos.
---

# Backend: cambios de base de datos (schema + migración en `init.ts`)

## Por qué esta tarea es especial

El proyecto **no usa `prisma migrate`**. Hay dos piezas que deben decir lo mismo:

| Pieza | Para qué sirve | Se actualiza... |
|---|---|---|
| `backend/prisma/schema.prisma` | tipos del Prisma Client (`npm run db:generate`) | siempre |
| `backend/src/prisma/init.ts` (`initializeDatabase()`) | **crea y actualiza el archivo SQLite real** al arrancar el servidor, con SQL manual y una tabla `_migrations` | siempre, con una migración **nueva** |

Si solo cambias `schema.prisma`, tu BD local puede seguir funcionando, pero cualquier BD nueva o el servidor en producción fallan con `no such table` / `no such column`. Es el error más fácil de cometer aquí, y `fullstack-verify-changes/scripts/preflight.mjs` lo detecta (compara modelos y columnas contra el SQL de las migraciones).

## Procedimiento

1. **Edita `schema.prisma`** con las convenciones: campos `camelCase` + `@map("snake_case")`, tabla `@@map("plural_snake")`, `createdAt`/`updatedAt` en tablas nuevas, `@@index` para FKs y filtros frecuentes, enums de Prisma (se guardan como TEXT). Si añades una relación, agrega el campo inverso en el otro modelo (Prisma lo exige).
2. **Traduce a SQL** con la tabla de equivalencias de abajo. Plantillas en `references/migration-templates.md`.
3. **Añade una migración nueva** en `init.ts`, justo después del último bloque `00N_...` y antes de "Sembrar Administrador". Id = siguiente número + nombre (`003_suppliers`). Usa el patrón: comprobar `_migrations` -> `db.transaction` -> DDL idempotente -> insertar el id.
4. **Regenera tipos**: `cd backend && npm run db:generate`; reinicia el dev server.
5. **Datos iniciales** (si aplica): filas imprescindibles de forma idempotente dentro de `init.ts`; datos de demo en `prisma/seed.ts` (agrega el `deleteMany()` del modelo nuevo **antes** de los modelos de los que depende, respetando FKs).
6. **Prueba la migración** (obligatorio) con el script, que usa copias y nunca toca tu BD:
   ```bash
   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --table <tabla>
   node .claude/skills/fullstack-verify-changes/scripts/db-check.mjs --from backend/prisma/dev.db
   ```
   La primera crea una BD vacía, corre `initializeDatabase()` **dos veces** (idempotencia) y muestra tablas, migraciones y columnas. La segunda clona tu BD real y la migra (caso "actualizar instalación existente").
7. `npx tsc --noEmit` y `node .claude/skills/fullstack-verify-changes/scripts/preflight.mjs`.

## Reglas (con su porqué)

- **Nunca edites una migración ya publicada ni `001_initial_schema.sql` / `INITIAL_SCHEMA_SQL`.** Las BDs existentes ya las aplicaron y no volverán a correrlas; una BD nueva ejecuta 001 y luego tus migraciones en orden, así que añadir una migración nueva funciona en ambos casos.
- **No agregues archivos `.sql` esperando que corran**: solo `001` se lee de disco.
- **No uses `prisma db push` ni `prisma migrate` contra la BD real.** Comprobado: `db push` intenta *borrar la tabla `_migrations`* (y exige `--accept-data-loss`), lo que borraría el historial y reaplicaría `001`.
- **Todo idempotente**: `CREATE TABLE/INDEX IF NOT EXISTS`; para columnas, consulta `PRAGMA table_info("tabla")` antes de `ALTER TABLE ... ADD COLUMN`. La migración puede ejecutarse sobre BDs a medio estado.
- **SQLite y `ALTER TABLE`**: `ADD COLUMN` no admite `NOT NULL` sin `DEFAULT` ni `PRIMARY KEY`/`UNIQUE` (crea el índice aparte). `RENAME COLUMN` y `DROP COLUMN` existen (SQLite 3.53 con better-sqlite3 13) pero `DROP COLUMN` falla si la columna está indexada, es FK o es única. Para cambiar restricciones o tipos: reconstruir la tabla (plantilla).
- **Backup manual antes de una migración destructiva** (drop, rebuild, backfill grande): copia el `.db` (y `-wal`/`-shm` si existen). El backup diario automático corre **después** de migrar, así que no te protege ese día.
- **`seedInitialData` corre justo tras `001`**, antes de tus migraciones. Si tu migración renombra/elimina columnas que usa ese SQL de ejemplo, actualiza ese seed.
- **Prisma al escribir con SQL crudo**: `@updatedAt` lo pone el Client; en inserts manuales (`better-sqlite3`) incluye `updated_at` o confía en `DEFAULT CURRENT_TIMESTAMP`.
- **Enums**: añadir un valor no requiere DDL (es TEXT sin CHECK), pero sí `db:generate`, actualizar uniones de tipos escritas a mano en services (p. ej. `'PREPARED' | 'DIRECT_INVENTORY'`) y los mapas de etiquetas del frontend.
- **Borrado de datos referenciados**: elige explícitamente `onDelete` (`Restrict` por defecto en relaciones obligatorias, `SetNull` en opcionales, `Cascade` solo para detalles que no tienen sentido sin su padre) y refléjalo igual en `schema.prisma` y en el DDL.

## Equivalencias Prisma -> SQLite (DDL)

| Prisma | DDL |
|---|---|
| `Int @id @default(autoincrement())` | `"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT` |
| `Int` / `Float` / `String` | `INTEGER` / `REAL` / `TEXT` |
| `Boolean @default(true)` | `BOOLEAN NOT NULL DEFAULT 1` |
| `DateTime @default(now())` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `@updatedAt` | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| enum / `String @default("X")` | `TEXT NOT NULL DEFAULT 'X'` |
| tipo opcional (`String?`) | columna sin `NOT NULL` |
| `@default(0.0)` | `REAL NOT NULL DEFAULT 0.0` |
| `@unique` en `col` | `CREATE UNIQUE INDEX IF NOT EXISTS "<tabla>_<col>_key" ON "<tabla>"("<col>")` |
| `@@index([a])` | `CREATE INDEX IF NOT EXISTS "<tabla>_<a>_idx" ON "<tabla>"("<a>")` |
| `@@unique([a, b])` | `CREATE UNIQUE INDEX IF NOT EXISTS "<tabla>_<a>_<b>_key" ON "<tabla>"("a", "b")` |
| relación obligatoria | `CONSTRAINT "<tabla>_<col>_fkey" FOREIGN KEY ("<col>") REFERENCES "<otra>" ("id") ON DELETE RESTRICT ON UPDATE CASCADE` |
| relación opcional | igual con `ON DELETE SET NULL` |
| `onDelete: Cascade` | igual con `ON DELETE CASCADE` |
| JSON libre | `TEXT` con `JSON.stringify`/`JSON.parse` (patrón de las denominaciones de caja) |

## Terminado cuando

- [ ] `schema.prisma` y la migración nueva describen exactamente las mismas tablas/columnas/índices/FKs.
- [ ] `db-check.mjs` pasa en BD vacía y sobre una copia de tu BD, y es idempotente (2.ª ejecución sin cambios).
- [ ] `npm run db:generate` ejecutado y `npx tsc --noEmit` limpio.
- [ ] Datos iniciales/`seed.ts` actualizados si hacen falta.
- [ ] `data-model.md` actualizado (`fullstack-domain-reference`).
- [ ] Avisaste al usuario de cualquier paso destructivo y de hacer copia del `.db` antes de desplegar.
