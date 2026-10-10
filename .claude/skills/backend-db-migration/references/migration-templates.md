# Plantillas de migración para `backend/src/prisma/init.ts`

Cada plantilla es un bloque que se pega dentro de `initializeDatabase()`, después de la última migración (`002_...`) y antes del bloque "Sembrar Administrador". Reutilizan el objeto `db` (better-sqlite3) ya abierto en esa función. Reemplaza `003_nombre`, tablas y columnas.

## Contenido
- Esqueleto común
- Tabla nueva (con índice único)
- Tabla hija con FK
- Columna nueva en tabla existente (+ backfill)
- Índice nuevo
- Renombrar / eliminar columna
- Reconstruir tabla (cambiar tipo o restricciones)
- Datos iniciales idempotentes
- Qué pegar también en `schema.prisma`

## Esqueleto común

```ts
    // N. Migración incremental 003_nombre
    const check003 = db.prepare('SELECT id FROM "_migrations" WHERE id = ?').get('003_nombre');
    if (!check003) {
      const mig003Tx = db.transaction(() => {
        // ... DDL / UPDATE idempotentes aquí ...

        db.prepare('INSERT INTO "_migrations" (id) VALUES (?)').run('003_nombre');
      });
      mig003Tx();
    }
```

Reglas: id inmutable y único; una migración = una transacción; nunca referencies código de negocio (solo SQL); si falla, el error se propaga a `initializeDatabase()` (el servidor arrancará sin esa migración y las rutas fallarán, así que prueba con `db-check.mjs`).

## Tabla nueva (con índice único)

```ts
    // N. Migración incremental 003_suppliers
    const check003 = db.prepare('SELECT id FROM "_migrations" WHERE id = ?').get('003_suppliers');
    if (!check003) {
      const mig003Tx = db.transaction(() => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS "suppliers" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "name" TEXT NOT NULL,
              "phone" TEXT,
              "email" TEXT,
              "active" BOOLEAN NOT NULL DEFAULT 1,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_name_key" ON "suppliers"("name");
        `);

        db.prepare('INSERT INTO "_migrations" (id) VALUES (?)').run('003_suppliers');
      });
      mig003Tx();
    }
```

## Tabla hija con FK

Orden: crea primero la tabla padre (en esta u otra migración). Cascade solo para detalles que no existen sin su cabecera.

```ts
        db.exec(`
          CREATE TABLE IF NOT EXISTS "purchase_details" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "purchase_id" INTEGER NOT NULL,
              "ingredient_id" INTEGER NOT NULL,
              "quantity" REAL NOT NULL,
              "unit_cost" REAL NOT NULL,
              "subtotal" REAL NOT NULL,
              CONSTRAINT "purchase_details_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "purchase_details_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
          );
          CREATE INDEX IF NOT EXISTS "purchase_details_purchase_id_idx" ON "purchase_details"("purchase_id");
          CREATE INDEX IF NOT EXISTS "purchase_details_ingredient_id_idx" ON "purchase_details"("ingredient_id");
        `);
```

## Columna nueva en tabla existente (+ backfill)

```ts
    // N. Migración incremental 004_products_barcode
    const check004 = db.prepare('SELECT id FROM "_migrations" WHERE id = ?').get('004_products_barcode');
    if (!check004) {
      const mig004Tx = db.transaction(() => {
        const productCols = (db.pragma('table_info("products")') as Array<{ name: string }>).map((c) => c.name);
        if (!productCols.includes('barcode')) {
          // Nullable (o NOT NULL con DEFAULT): SQLite no permite NOT NULL sin DEFAULT en ADD COLUMN
          db.exec('ALTER TABLE "products" ADD COLUMN "barcode" TEXT;');
        }

        // Backfill opcional de filas existentes
        // db.exec(`UPDATE "products" SET "barcode" = NULL WHERE "barcode" = ''`);

        db.prepare('INSERT INTO "_migrations" (id) VALUES (?)').run('004_products_barcode');
      });
      mig004Tx();
    }
```

En `schema.prisma`: `barcode String?` (o con `@default`). Si luego necesitas unicidad: `CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_key" ON "products"("barcode");` (varios `NULL` están permitidos).

## Índice nuevo

```ts
        db.exec('CREATE INDEX IF NOT EXISTS "orders_date_idx" ON "orders"("date");');
```

Y `@@index([date])` en el modelo.

## Renombrar / eliminar columna

```ts
        const cols = (db.pragma('table_info("products")') as Array<{ name: string }>).map((c) => c.name);
        if (cols.includes('old_name') && !cols.includes('new_name')) {
          db.exec('ALTER TABLE "products" RENAME COLUMN "old_name" TO "new_name";');
        }
        if (cols.includes('obsolete')) {
          // Falla si la columna está indexada, es FK o UNIQUE: elimina antes el índice o reconstruye la tabla
          db.exec('ALTER TABLE "products" DROP COLUMN "obsolete";');
        }
```

Cambios destructivos: avisa al usuario, haz copia del `.db` primero y busca todos los usos (`Grep` del nombre en `backend/src`, `frontend/src`, plantillas Excel y `seed.ts`).

## Reconstruir tabla (cambiar tipo o restricciones)

`PRAGMA foreign_keys` **no** puede cambiarse dentro de una transacción: apágalo antes y vuélvelo a encender después.

```ts
    const check005 = db.prepare('SELECT id FROM "_migrations" WHERE id = ?').get('005_rebuild_products');
    if (!check005) {
      db.pragma('foreign_keys = OFF');
      try {
        const mig005Tx = db.transaction(() => {
          db.exec(`
            CREATE TABLE "products_new" (
                -- definición completa y final de la tabla
                "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
                -- ...
            );
            INSERT INTO "products_new" (id /* , columnas */) SELECT id /* , columnas */ FROM "products";
            DROP TABLE "products";
            ALTER TABLE "products_new" RENAME TO "products";
            -- recrear TODOS los índices de la tabla original
          `);
          const violations = db.pragma('foreign_key_check') as unknown[];
          if (violations.length > 0) {
            throw new Error('foreign_key_check falló tras reconstruir products');
          }
          db.prepare('INSERT INTO "_migrations" (id) VALUES (?)').run('005_rebuild_products');
        });
        mig005Tx();
      } finally {
        db.pragma('foreign_keys = ON');
      }
    }
```

## Datos iniciales idempotentes

Filas imprescindibles para que la app funcione (no demo):

```ts
        const hasDefault = db.prepare('SELECT id FROM "categories" WHERE name = ?').get('General');
        if (!hasDefault) {
          db.prepare('INSERT INTO "categories" (name, description, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
            .run('General', 'Categoría por defecto');
        }
```

Datos de demostración van en `prisma/seed.ts` (es destructivo: empieza con `deleteMany()` de cada modelo, hijos primero; agrega el modelo nuevo en el lugar correcto).

## Qué pegar también en `schema.prisma`

Cada columna/tabla/índice del SQL debe tener su equivalente en el modelo (`@map`, `@@map`, `@@index`, `@unique`, `@relation(... onDelete: ...)`). Tras editar: `npm run db:generate`. Verifica con `db-check.mjs` y `preflight.mjs`.
