---
name: express-crud-handlers-sqlite
description: Genera controladores CRUD completos y seguros para Express + SQLite. Usa esta skill SIEMPRE que necesites crear funciones GET, POST, PUT, DELETE con validación robusta, sanitización contra SQL injection, paginación, ordenamiento y manejo de errores centralizado. Incluye asyncHandler, validadores, errores personalizados y ejemplos HTTP completos. Lista para producción.
---

# Express CRUD Handlers with SQLite - Professional Implementation

Genera controladores CRUD seguros, validados y optimizados para SQLite. Incluye protección contra SQL injection, paginación, filtros, manejo robusto de errores y documentación completa.

---

## 🎯 Cuándo Usar Esta Skill

**SIEMPRE usa esta skill cuando:**
- ✅ Necesites crear controladores CRUD (GET, POST, PUT, DELETE)
- ✅ Quieras implementar lógica de negocio segura
- ✅ Requieras validación y sanitización de datos
- ✅ Necesites protección contra SQL injection
- ✅ Busques paginación y filtros eficientes
- ✅ Quieras manejo de errores profesional

---

## 🔒 Seguridad: Protección Contra SQL Injection

### El Problema
```javascript
// ❌ NUNCA HAGAS ESTO - VULNERABLE A SQL INJECTION
const id = req.params.id;
const product = db.exec(`SELECT * FROM products WHERE id = ${id}`);

// Un atacante podría enviar: id = "1; DROP TABLE products; --"
// Y se ejecutaría: SELECT * FROM products WHERE id = 1; DROP TABLE products; --
```

### La Solución
```javascript
// ✅ SIEMPRE USA QUERIES PARAMETRIZADAS (mejor-sqlite3)
const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
const product = stmt.get(id); // El parámetro se sanitiza automáticamente

// Los parámetros se escapan correctamente:
// SELECT * FROM products WHERE id = '1; DROP TABLE products; --'
// ↑ Se trata como string literal, no como código SQL
```

---

## 📝 Información Requerida

```
🔹 Nombre del recurso (singular)
   Ejemplo: product, user, article

🔹 Tabla en la BD
   Ejemplo: products, users, articles

🔹 Campos del modelo con tipos
   Ejemplo: 
   - id (INTEGER PRIMARY KEY)
   - name (TEXT NOT NULL)
   - price (REAL NOT NULL)
   - stock (INTEGER DEFAULT 0)
   - createdAt (DATETIME)

🔹 Campos únicos (para evitar duplicados)
   Ejemplo: email, username

🔹 Validaciones personalizadas
   Ejemplo: email válido, age >= 18

🔹 Relaciones (si las hay)
   Ejemplo: belongs_to(user), has_many(orders)
```

---

## 🔧 Estructura Completa del Controlador

### Archivo: `controllers/productController.js`

```javascript
const db = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/customErrors');

// ═══════════════════════════════════════════════════════════════
// GET - Obtener todos con paginación
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/products
 * Obtener todos los productos con paginación, ordenamiento y filtros
 * 
 * @param {Object} req - Request
 * @param {number} req.query.page - Página (default: 1)
 * @param {number} req.query.limit - Items por página (default: 10)
 * @param {string} req.query.sort - Campo a ordenar (default: -id)
 * 
 * @param {Object} res - Response
 * 
 * @returns {Object} { success, data, pagination }
 * 
 * @throws {Error} Si hay error en BD
 */
const getAllProducts = async (req, res) => {
  // ✅ Los valores ya están validados y sanitizados por el middleware
  const { page = 1, limit = 10, sort = '-id' } = req.query;

  try {
    // Calcular offset para paginación
    const offset = (page - 1) * limit;

    // ✅ Contar total de registros (PARAMETRIZADO)
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM products');
    const { total } = countStmt.get();

    // Preparar sort seguro
    const sortField = sort.replace(/^-/, '');
    const sortDirection = sort.startsWith('-') ? 'DESC' : 'ASC';

    // ✅ SELECT parametrizado y seguro contra SQL injection
    const query = `
      SELECT id, name, description, price, stock, createdAt, updatedAt
      FROM products
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const stmt = db.prepare(query);
    const products = stmt.all(limit, offset);

    // Responder con estructura consistente
    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[getAllProducts] Error:', error);
    throw new Error('Error al obtener productos');
  }
};

// ═══════════════════════════════════════════════════════════════
// GET BY ID - Obtener un registro por ID
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/products/:id
 * Obtener un producto por su ID
 * 
 * @param {Object} req - Request
 * @param {number} req.params.id - ID del producto
 * 
 * @param {Object} res - Response
 * 
 * @returns {Object} { success, data }
 * 
 * @throws {NotFoundError} Si el producto no existe
 */
const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    // ✅ Query parametrizado - seguro contra SQL injection
    const stmt = db.prepare(`
      SELECT id, name, description, price, stock, createdAt, updatedAt
      FROM products
      WHERE id = ?
    `);

    const product = stmt.get(id);

    // Verificar que existe
    if (!product) {
      throw new NotFoundError(`Producto con ID ${id} no encontrado`);
    }

    res.status(200).json({
      success: true,
      data: product
    });

  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('[getProductById] Error:', error);
    throw new Error('Error al obtener producto');
  }
};

// ═══════════════════════════════════════════════════════════════
// POST - Crear nuevo registro
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/products
 * Crear un nuevo producto
 * 
 * @param {Object} req - Request
 * @param {string} req.body.name - Nombre (validado por middleware)
 * @param {string} req.body.description - Descripción (opcional)
 * @param {number} req.body.price - Precio (validado por middleware)
 * @param {number} req.body.stock - Stock (opcional, default 0)
 * 
 * @param {Object} res - Response
 * 
 * @returns {Object} { success, message, data }
 * 
 * @throws {ValidationError} Si los datos no son válidos
 * @throws {Error} Si hay error en BD
 */
const createProduct = async (req, res) => {
  // ✅ Los datos ya fueron validados por el middleware
  const { name, description = '', price, stock = 0 } = req.body;

  try {
    // ✅ Verificar que no existe duplicado (nombre único)
    const existingStmt = db.prepare('SELECT id FROM products WHERE name = ?');
    const existing = existingStmt.get(name.trim());

    if (existing) {
      throw new ValidationError(`Ya existe un producto con el nombre "${name}"`);
    }

    // ✅ INSERT parametrizado - seguro contra SQL injection
    const insertStmt = db.prepare(`
      INSERT INTO products (name, description, price, stock, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    // Ejecutar inserción
    const info = insertStmt.run(
      name.trim(),
      description.trim(),
      price,
      stock
    );

    // ✅ Obtener el registro recién creado
    const getStmt = db.prepare(`
      SELECT id, name, description, price, stock, createdAt, updatedAt
      FROM products
      WHERE id = ?
    `);

    const newProduct = getStmt.get(info.lastID);

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: newProduct
    });

  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('[createProduct] Error:', error);
    throw new Error('Error al crear producto');
  }
};

// ═══════════════════════════════════════════════════════════════
// PUT - Actualizar registro
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/products/:id
 * Actualizar un producto existente
 * 
 * @param {Object} req - Request
 * @param {number} req.params.id - ID del producto
 * @param {string} req.body.name - Nombre (opcional)
 * @param {string} req.body.description - Descripción (opcional)
 * @param {number} req.body.price - Precio (opcional)
 * @param {number} req.body.stock - Stock (opcional)
 * 
 * @param {Object} res - Response
 * 
 * @returns {Object} { success, message, data }
 * 
 * @throws {NotFoundError} Si el producto no existe
 * @throws {ValidationError} Si hay conflicto de datos
 */
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock } = req.body;

  try {
    // ✅ Verificar que el producto existe
    const checkStmt = db.prepare('SELECT id FROM products WHERE id = ?');
    const product = checkStmt.get(id);

    if (!product) {
      throw new NotFoundError(`Producto con ID ${id} no encontrado`);
    }

    // Preparar campos a actualizar
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description.trim());
    }

    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }

    if (stock !== undefined) {
      updates.push('stock = ?');
      values.push(stock);
    }

    // Agregar timestamp de actualización
    updates.push('updatedAt = CURRENT_TIMESTAMP');

    // Agregar ID al final
    values.push(id);

    // ✅ UPDATE parametrizado - seguro contra SQL injection
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = ?`;
    const updateStmt = db.prepare(query);

    updateStmt.run(...values);

    // ✅ Obtener registro actualizado
    const getStmt = db.prepare(`
      SELECT id, name, description, price, stock, createdAt, updatedAt
      FROM products
      WHERE id = ?
    `);

    const updatedProduct = getStmt.get(id);

    res.status(200).json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: updatedProduct
    });

  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    console.error('[updateProduct] Error:', error);
    throw new Error('Error al actualizar producto');
  }
};

// ═══════════════════════════════════════════════════════════════
// DELETE - Eliminar registro
// ═══════════════════════════════════════════════════════════════

/**
 * DELETE /api/products/:id
 * Eliminar un producto
 * 
 * @param {Object} req - Request
 * @param {number} req.params.id - ID del producto
 * 
 * @param {Object} res - Response
 * 
 * @returns {Object} { success, message, data }
 * 
 * @throws {NotFoundError} Si el producto no existe
 */
const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    // ✅ Obtener el registro antes de eliminarlo (para retornar)
    const getStmt = db.prepare(`
      SELECT id, name, description, price, stock, createdAt, updatedAt
      FROM products
      WHERE id = ?
    `);

    const product = getStmt.get(id);

    if (!product) {
      throw new NotFoundError(`Producto con ID ${id} no encontrado`);
    }

    // ✅ DELETE parametrizado - seguro contra SQL injection
    const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');
    deleteStmt.run(id);

    res.status(200).json({
      success: true,
      message: 'Producto eliminado exitosamente',
      data: product
    });

  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('[deleteProduct] Error:', error);
    throw new Error('Error al eliminar producto');
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
```

---

## 🛡️ Utilitarios: Errores Personalizados

### Archivo: `utils/customErrors.js`

```javascript
/**
 * Clase base para todos los errores de la aplicación
 * Incluye status code HTTP automático
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error 404: Recurso no encontrado
 * 
 * Ejemplo: Producto con ID 999 no existe
 */
class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

/**
 * Error 400: Datos inválidos
 * 
 * Ejemplo: Email formato inválido, precio negativo
 */
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Error 401: No autenticado
 * 
 * Ejemplo: Token expirado o no proporcionado
 */
class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, 401);
  }
}

/**
 * Error 403: No autorizado
 * 
 * Ejemplo: Usuario no tiene permisos
 */
class ForbiddenError extends AppError {
  constructor(message = 'Acceso prohibido') {
    super(message, 403);
  }
}

/**
 * Error 409: Conflicto
 * 
 * Ejemplo: Email ya existe
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};
```

---

## ⚙️ Middleware: AsyncHandler

### Archivo: `middleware/asyncHandler.js`

```javascript
/**
 * AsyncHandler: Captura automáticamente errores en funciones async
 * 
 * Evita repetir try-catch en cada controlador.
 * Los errores se pasan automáticamente al middleware de errores centralizado.
 * 
 * @param {Function} fn - Función async a ejecutar
 * @returns {Function} - Middleware que maneja errores automáticamente
 * 
 * Uso:
 * router.get('/', asyncHandler(getAllProducts));
 * 
 * Cómo funciona:
 * 1. La función async se ejecuta dentro de Promise.resolve()
 * 2. Si la función lanza un error, .catch(next) lo captura
 * 3. next() pasa el error al middleware de errores global
 * 4. El middleware global responde al cliente con status 400/404/500
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
```

---

## 🔧 Configuración: Base de Datos

### Archivo: `config/database.js`

```javascript
const Database = require('better-sqlite3');
const path = require('path');

// Crear o conectar a la BD
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/app.db');

console.log(`📁 BD en: ${dbPath}`);

const db = new Database(dbPath);

// ✅ Activar foreign keys para integridad referencial
db.pragma('foreign_keys = ON');

// ✅ Activar WAL mode para mejor concurrencia
db.pragma('journal_mode = WAL');

/**
 * Inicializar base de datos
 * Crea tablas e índices si no existen
 */
const initDatabase = () => {
  // Crear tabla de productos
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ✅ Crear índices para búsquedas rápidas
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_createdAt ON products(createdAt DESC);
  `);

  console.log('✅ Base de datos inicializada');
};

// Inicializar al conectar
initDatabase();

module.exports = db;
```

---

## 🛑 Middleware: Error Handler Global

### Archivo: `middleware/errorHandler.js`

```javascript
const { AppError } = require('../utils/customErrors');

/**
 * Middleware de manejo centralizado de errores
 * 
 * IMPORTANTE: Este debe ser el ÚLTIMO middleware registrado
 * en la aplicación Express (después de todas las rutas)
 * 
 * Captura cualquier error lanzado en controladores o middlewares
 * y responde con JSON estructurado
 * 
 * @param {Error} err - Error lanzado
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Siguiente middleware
 */
const errorHandler = (err, req, res, next) => {
  // Determinar status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Mensaje de error
  const message = err.message || 'Error interno del servidor';

  // Log en consola para debugging
  console.error(`
    ❌ Error [${statusCode}]: ${message}
    Ruta: ${req.method} ${req.path}
    Stack: ${err.stack}
  `);

  // Responder al cliente
  res.status(statusCode).json({
    success: false,
    message,
    // Solo mostrar stack en desarrollo para debugging
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err 
    })
  });
};

/**
 * Middleware para rutas no encontradas (404)
 * 
 * Este debe estar ANTES del errorHandler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta ${req.originalUrl} no encontrada`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
```

---

## 📚 Ejemplos HTTP Completos

### REST Client (archivo `.rest`)

```rest
### ════════════════════════════════════════════════════════════
### VARIABLES Y CONFIGURACIÓN
### ════════════════════════════════════════════════════════════

@baseUrl = http://localhost:3000/api
@productId = 1

### ════════════════════════════════════════════════════════════
### GET - OBTENER TODOS
### ════════════════════════════════════════════════════════════

### Todos los productos
GET {{baseUrl}}/products

### Con paginación
GET {{baseUrl}}/products?page=1&limit=10

### Con ordenamiento por precio DESC
GET {{baseUrl}}/products?sort=-price

### Con ordenamiento por nombre ASC
GET {{baseUrl}}/products?sort=name

### Combinado: página 2, 5 items, ordenado por precio
GET {{baseUrl}}/products?page=2&limit=5&sort=-price

### ════════════════════════════════════════════════════════════
### GET - OBTENER UNO POR ID
### ════════════════════════════════════════════════════════════

GET {{baseUrl}}/products/{{productId}}

### ════════════════════════════════════════════════════════════
### POST - CREAR NUEVO
### ════════════════════════════════════════════════════════════

### Crear producto válido
POST {{baseUrl}}/products
Content-Type: application/json

{
  "name": "Laptop XPS 13",
  "description": "Laptop profesional ultraportátil",
  "price": 1299.99,
  "stock": 50
}

### Crear con descripción vacía
POST {{baseUrl}}/products
Content-Type: application/json

{
  "name": "Monitor Dell",
  "price": 599.99
}

### Intentar crear sin nombre (error validación)
POST {{baseUrl}}/products
Content-Type: application/json

{
  "price": 999.99
}

### Intentar crear con precio negativo (error validación)
POST {{baseUrl}}/products
Content-Type: application/json

{
  "name": "Producto Inválido",
  "price": -50
}

### ════════════════════════════════════════════════════════════
### PUT - ACTUALIZAR
### ════════════════════════════════════════════════════════════

### Actualizar todo
PUT {{baseUrl}}/products/{{productId}}
Content-Type: application/json

{
  "name": "Laptop XPS 15 (Actualizada)",
  "description": "Laptop actualizada",
  "price": 1499.99,
  "stock": 30
}

### Actualizar solo el precio
PUT {{baseUrl}}/products/{{productId}}
Content-Type: application/json

{
  "price": 1199.99
}

### Actualizar solo el stock
PUT {{baseUrl}}/products/{{productId}}
Content-Type: application/json

{
  "stock": 100
}

### ════════════════════════════════════════════════════════════
### DELETE - ELIMINAR
### ════════════════════════════════════════════════════════════

DELETE {{baseUrl}}/products/{{productId}}
```

### cURL

```bash
# GET todos
curl "http://localhost:3000/api/products?page=1&limit=10"

# GET uno
curl "http://localhost:3000/api/products/1"

# POST crear
curl -X POST "http://localhost:3000/api/products" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop XPS",
    "description": "Laptop profesional",
    "price": 1299.99,
    "stock": 50
  }'

# PUT actualizar
curl -X PUT "http://localhost:3000/api/products/1" \
  -H "Content-Type: application/json" \
  -d '{"price": 1199.99}'

# DELETE eliminar
curl -X DELETE "http://localhost:3000/api/products/1"
```

### JavaScript/Fetch

```javascript
// GET todos
const products = await fetch('http://localhost:3000/api/products?page=1&limit=10')
  .then(res => res.json());

console.log(products);
// { success: true, data: [...], pagination: {...} }

// POST crear
const response = await fetch('http://localhost:3000/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Monitor 4K',
    description: 'Monitor ultra HD',
    price: 599.99,
    stock: 20
  })
});

const result = await response.json();
console.log(result);
// { success: true, message: "Producto creado exitosamente", data: {...} }

// PUT actualizar
const updated = await fetch('http://localhost:3000/api/products/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ price: 699.99 })
}).then(res => res.json());

console.log(updated);
// { success: true, message: "Producto actualizado exitosamente", data: {...} }

// DELETE eliminar
const deleted = await fetch('http://localhost:3000/api/products/1', {
  method: 'DELETE'
}).then(res => res.json());

console.log(deleted);
// { success: true, message: "Producto eliminado exitosamente", data: {...} }
```

---

## 📁 Estructura de Carpetas

```
proyecto/
├── config/
│   └── database.js          # Conexión SQLite y inicialización
├── controllers/
│   └── productController.js # Lógica CRUD (GET, POST, PUT, DELETE)
├── middleware/
│   ├── asyncHandler.js      # Wrapper para manejo automático de errores
│   ├── errorHandler.js      # Middleware centralizado de errores
│   └── validators.js        # Validadores de entrada
├── routes/
│   └── products.js          # Definición de rutas y rate limiting
├── utils/
│   └── customErrors.js      # Clases de errores personalizados
├── data/
│   └── app.db               # Archivo SQLite (creado automáticamente)
├── app.js                   # Configuración de Express
├── server.js                # Entry point
├── .env                     # Variables de entorno
└── package.json
```

---

## ✅ Mejor Prácticas Incluidas

✅ **Queries Parametrizadas** - Protección contra SQL injection  
✅ **Validación en Capas** - Middleware + Controlador + Base de datos  
✅ **AsyncHandler** - Manejo automático de errores en funciones async  
✅ **Errores Personalizados** - Con status codes HTTP correctos  
✅ **Paginación Eficiente** - OFFSET y LIMIT  
✅ **Índices en BD** - Búsquedas rápidas  
✅ **Logging** - Trazabilidad de operaciones  
✅ **Estructura Consistente** - Respuestas { success, data, message }  
✅ **Documentación JSDoc** - Funciones auto-documentadas  
✅ **Rate Limiting** - Prevención de abuse  

---

## 🚀 Instalación Rápida

```bash
# 1. Instalar dependencias
npm install express cors dotenv better-sqlite3 express-rate-limit

# 2. Crear estructura de carpetas
mkdir -p config controllers middleware routes utils data

# 3. Copiar archivos generados por esta skill

# 4. Crear .env
echo "PORT=3000" > .env
echo "NODE_ENV=development" >> .env
echo "DB_PATH=./data/app.db" >> .env

# 5. Iniciar servidor
node server.js
```

---

## 🔒 Seguridad: Resumen de Protecciones

| Amenaza | Protección | Implementación |
|---------|-----------|------------------|
| SQL Injection | Queries parametrizados | `db.prepare()` con `?` |
| Rate Limiting | Límite de peticiones | `express-rate-limit` |
| XSS | Validación de entrada | Middleware de validadores |
| CORS | Control de orígenes | Middleware CORS |
| Datos sensibles | No loguear passwords | Validadores seguros |
| Errores SQL | No exponer detalles | Error handler centralizado |

---

## 📊 Status Codes HTTP Utilizados

| Código | Operación | Significado |
|--------|-----------|------------|
| **200** | GET, PUT, DELETE | Exitoso |
| **201** | POST | Creado con éxito |
| **400** | * | Datos inválidos (validación fallida) |
| **404** | GET, PUT, DELETE | Recurso no encontrado |
| **429** | * | Demasiadas peticiones (rate limit) |
| **500** | * | Error interno del servidor |

---

## 💡 Tips Profesionales

1. **Siempre validar entrada** - No confiar en datos del cliente
2. **Usar queries parametrizados** - Previene SQL injection automáticamente
3. **Rate limiting** - Protege contra spam y DoS
4. **Logging detallado** - Facilita debugging en producción
5. **Mensajes de error genéricos** - No revelar detalles de la BD
6. **Índices en tablas** - Optimiza búsquedas frecuentes
7. **Timestamps** - Auditoría automática
8. **Soft delete** - Considerar para datos importantes

---

## 🔗 Conexión con Skill Anterior

Esta skill (**controladores CRUD**) funciona junto a la skill **`express-routes-professional`** que define las rutas.

**Flujo:**
1. **Skill 1**: Crea rutas en `routes/products.js` ← Middleware y validadores
2. **Skill 2**: Crea controladores en `controllers/productController.js` ← Lógica CRUD
3. Ambas se conectan automáticamente

