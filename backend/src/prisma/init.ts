import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sale_price" REAL NOT NULL,
    "image" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "product_type" TEXT NOT NULL DEFAULT 'PREPARED',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ingredients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "measurement_unit" TEXT NOT NULL,
    "current_stock" REAL NOT NULL DEFAULT 0.0,
    "minimum_stock" REAL NOT NULL DEFAULT 0.0,
    "unit_cost" REAL NOT NULL DEFAULT 0.0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "recipes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "recipe_details" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "measurement_unit" TEXT NOT NULL,
    CONSTRAINT "recipe_details_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_details_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "notes" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" REAL NOT NULL DEFAULT 0.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "order_details" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "notes" TEXT,
    CONSTRAINT "order_details_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "sales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoice_number" TEXT NOT NULL,
    "order_id" INTEGER,
    "subtotal" REAL NOT NULL,
    "tax" REAL NOT NULL DEFAULT 0.0,
    "discount" REAL NOT NULL DEFAULT 0.0,
    "total" REAL NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'CASH',
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "sale_details" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "sale_details_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sale_details_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ingredient_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "previous_stock" REAL NOT NULL,
    "new_stock" REAL NOT NULL,
    "reference" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "cash_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "initial_amount" REAL NOT NULL DEFAULT 0.0,
    "initial_denominations" TEXT NOT NULL,
    "final_amount" REAL,
    "final_denominations" TEXT,
    "notes" TEXT,
    "closing_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products"("category_id");
CREATE INDEX IF NOT EXISTS "products_available_idx" ON "products"("available");
CREATE UNIQUE INDEX IF NOT EXISTS "ingredients_name_key" ON "ingredients"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "recipes_product_id_key" ON "recipes"("product_id");
CREATE INDEX IF NOT EXISTS "recipe_details_recipe_id_idx" ON "recipe_details"("recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_details_ingredient_id_idx" ON "recipe_details"("ingredient_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recipe_details_recipe_id_ingredient_id_key" ON "recipe_details"("recipe_id", "ingredient_id");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_number_key" ON "orders"("number");
CREATE INDEX IF NOT EXISTS "order_details_order_id_idx" ON "order_details"("order_id");
CREATE INDEX IF NOT EXISTS "order_details_product_id_idx" ON "order_details"("product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_invoice_number_key" ON "sales"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_order_id_key" ON "sales"("order_id");
CREATE INDEX IF NOT EXISTS "sale_details_sale_id_idx" ON "sale_details"("sale_id");
CREATE INDEX IF NOT EXISTS "sale_details_product_id_idx" ON "sale_details"("product_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_ingredient_id_idx" ON "inventory_movements"("ingredient_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_date_idx" ON "inventory_movements"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_sessions_session_number_key" ON "cash_sessions"("session_number");
`;

export async function initializeDatabase(): Promise<void> {
  const dbPath = process.env.SQLITE_DB_PATH ||
    (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, '') : path.resolve(process.cwd(), 'prisma/dev.db'));

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const backupDir = process.env.SQLITE_BACKUP_DIR || path.join(dbDir, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[DB Init] Inicializando SQLite en: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  try {
    // 1. Tabla de migraciones
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" TEXT PRIMARY KEY,
        "applied_at" DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Verificar si ya se aplicó el esquema
    const checkStmt = db.prepare('SELECT id FROM "_migrations" WHERE id = ?');
    const applied = checkStmt.get('001_initial_schema');

    if (!applied) {
      console.log('[DB Init] Aplicando esquema DDL inicial...');
      let ddl = INITIAL_SCHEMA_SQL;

      // Si existe el archivo de migración en disco, preferirlo
      const migrationFile = path.resolve(__dirname, '../../prisma/migrations/001_initial_schema.sql');
      if (fs.existsSync(migrationFile)) {
        try {
          ddl = fs.readFileSync(migrationFile, 'utf8');
        } catch (_) {}
      }

      const applyTx = db.transaction(() => {
        db.exec(ddl);
        db.prepare('INSERT INTO "_migrations" (id) VALUES (?)').run('001_initial_schema');
      });
      applyTx();
      console.log('[DB Init] ✅ Esquema inicial aplicado.');

      // 3. Sembrar datos de muestra si está vacía
      const catCount = (db.prepare('SELECT count(*) as c FROM categories').get() as { c: number }).c;
      if (catCount === 0) {
        console.log('[DB Init] Sembrando catálogo base...');
        seedInitialData(db);
        console.log('[DB Init] ✅ Catálogo base sembrado.');
      }
    } else {
      console.log('[DB Init] Base de datos verificada (esquema ya aplicado).');
    }

    // 4. Backup diario
    await runDailyBackup(db, backupDir);

  } finally {
    db.close();
  }
}

function seedInitialData(db: Database.Database): void {
  const seedTx = db.transaction(() => {
    const insertCat = db.prepare('INSERT INTO categories (name, description, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const catBebidas = insertCat.run('Bebidas', 'Cafés, tés, jugos y gaseosas');
    const catHamburguesas = insertCat.run('Hamburguesas', 'Hamburguesas artesanales de la casa');
    const catPostres = insertCat.run('Postres', 'Postres caseros');

    const insertIng = db.prepare(`
      INSERT INTO ingredients (name, description, measurement_unit, current_stock, minimum_stock, unit_cost, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const ingPan = insertIng.run('Pan de Hamburguesa', 'Pan brioche artesanal', 'unidad', 100, 20, 0.5);
    const ingCarne = insertIng.run('Carne de Res 150g', 'Carne molida seleccionada', 'unidad', 80, 15, 1.5);
    const ingQueso = insertIng.run('Lámina de Queso Cheddar', 'Queso madurado', 'unidad', 150, 30, 0.3);

    const insertProd = db.prepare(`
      INSERT INTO products (category_id, name, description, sale_price, product_type, available, updated_at)
      VALUES (?, ?, ?, ?, 'PREPARED', 1, CURRENT_TIMESTAMP)
    `);
    const prodBurger = insertProd.run(catHamburguesas.lastInsertRowid, 'Hamburguesa con Queso', 'Hamburguesa con carne 150g, pan suave y doble queso cheddar', 7.50);
    const prodCappuccino = insertProd.run(catBebidas.lastInsertRowid, 'Café Cappuccino', 'Espresso con leche al vapor y espumada', 3.50);

    const insertDirectProd = db.prepare(`
      INSERT INTO products (category_id, name, description, sale_price, product_type, available, updated_at)
      VALUES (?, ?, ?, ?, 'DIRECT_INVENTORY', 1, CURRENT_TIMESTAMP)
    `);
    insertDirectProd.run(catBebidas.lastInsertRowid, 'Gaseosa 350ml', 'Lata de gaseosa fría', 2.00);

    const insertRecipe = db.prepare('INSERT INTO recipes (product_id, name, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const recipe = insertRecipe.run(prodBurger.lastInsertRowid, 'Receta Hamburguesa con Queso');

    const insertRecipeDetail = db.prepare('INSERT INTO recipe_details (recipe_id, ingredient_id, quantity, measurement_unit) VALUES (?, ?, ?, ?)');
    insertRecipeDetail.run(recipe.lastInsertRowid, ingPan.lastInsertRowid, 1, 'unidad');
    insertRecipeDetail.run(recipe.lastInsertRowid, ingCarne.lastInsertRowid, 1, 'unidad');
    insertRecipeDetail.run(recipe.lastInsertRowid, ingQueso.lastInsertRowid, 2, 'unidad');
  });

  seedTx();
}

async function runDailyBackup(db: Database.Database, backupDir: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const backupFileName = `backup-${today}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    if (!fs.existsSync(backupFilePath)) {
      console.log(`[DB Init] Creando copia de seguridad diaria: ${backupFileName}...`);
      await db.backup(backupFilePath);
      console.log(`[DB Init] ✅ Copia de seguridad creada en: ${backupFilePath}`);
    }
  } catch (err) {
    console.warn('[DB Init] Advertencia durante backup diario:', err);
  }
}
