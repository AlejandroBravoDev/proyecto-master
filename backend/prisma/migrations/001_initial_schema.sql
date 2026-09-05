-- ====================================================
-- ESQUEMA DDL INICIAL DE BASE DE DATOS SQLITE
-- Sistema Restaurante POS
-- ====================================================

-- 1. Categorías del Menú
CREATE TABLE IF NOT EXISTS "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Productos del Menú
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

-- 3. Insumos / Ingredientes
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

-- 4. Recetas (1-a-1 con Producto)
CREATE TABLE IF NOT EXISTS "recipes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. Detalles de Receta (Insumos requeridos)
CREATE TABLE IF NOT EXISTS "recipe_details" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipe_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "measurement_unit" TEXT NOT NULL,
    CONSTRAINT "recipe_details_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recipe_details_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. Comandas / Pedidos
CREATE TABLE IF NOT EXISTS "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "notes" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" REAL NOT NULL DEFAULT 0.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Detalles de Comanda
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

-- 8. Facturación y Ventas
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

-- 9. Detalles de Venta
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

-- 10. Movimientos de Inventario (Kardex)
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

-- 11. Sesiones de Caja (Turnos y Arqueos)
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

-- ====================================================
-- ÍNDICES PARA RENDIMIENTO Y UNICIDAD
-- ====================================================
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
