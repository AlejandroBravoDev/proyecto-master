---
name: express-routes-professional
description: Crea rutas Express profesionales, seguras y escalables para REST APIs. Usa esta skill SIEMPRE que necesites crear endpoints (GET, POST, PUT, DELETE) con validación, rate limiting, CORS, middlewares y documentación. Incluye mejores prácticas de seguridad como sanitización de entrada, validadores reutilizables, manejo de errores centralizado y ejemplos de uso. Perfecta para APIs REST simples con Express.js.
---

# Express Routes Professional - Skill for Creating Secure REST Endpoints

Crea rutas Express profesionales, seguras y lisas para producción. Esta skill genera endpoints REST completos con validación robusta, rate limiting, middlewares de seguridad y documentación clara.

---

## 🎯 Cuándo Usar Esta Skill

**SIEMPRE usa esta skill cuando:**
- ✅ Necesites crear nuevos endpoints (GET, POST, PUT, DELETE)
- ✅ Quieras seguir arquitectura REST profesional
- ✅ Requieras validación de entrada
- ✅ Necesites rate limiting para evitar abuse
- ✅ Busques código limpio y reutilizable
- ✅ Quieras documentación automática

---

## 📋 Información Requerida

Antes de generar rutas, reúne:

```
🔹 Nombre del recurso (singular)
   Ejemplo: product, user, order, article

🔹 Ruta base de la API
   Ejemplo: /api/products, /api/users

🔹 Operaciones CRUD necesarias
   Ejemplo: GET (listar, obtener uno), POST, PUT, DELETE

🔹 Parámetros de paginación
   Ejemplo: page, limit, sort, filters

🔹 Campos a validar
   Ejemplo: name (string, requerido), email (válido), price (número > 0)

🔹 Permisos/autenticación
   Ejemplo: pública, solo lectura, requiere token
```

---

## 🔒 Principios de Seguridad Implementados

### 1. **Validación de Entrada (Input Validation)**
```javascript
// ✅ CORRECTO: Validar TODO desde el cliente
const validateCreateProduct = (req, res, next) => {
  const { name, price } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ 
      success: false, 
      message: 'Nombre requerido y debe ser string' 
    });
  }
  
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Precio debe ser número positivo' 
    });
  }
  
  next();
};

// ❌ INCORRECTO: No validar entrada
router.post('/', (req, res) => {
  const product = req.body; // PELIGROSO: acepta cualquier cosa
  // Procesar sin validar...
});
```

### 2. **Sanitización de Datos (XSS Prevention)**
```javascript
// ✅ CORRECTO: Sanitizar strings
const sanitizeString = (str) => {
  if (!str) return '';
  return str.trim()
    .replace(/[<>]/g, '') // Remover HTML
    .substring(0, 100);    // Limitar longitud
};

// ❌ INCORRECTO: Confiar en datos del cliente
const name = req.body.name; // Sin sanitizar
```

### 3. **Rate Limiting (Prevenir Abuse)**
```javascript
// ✅ CORRECTO: Limitar peticiones
const rateLimit = require('express-rate-limit');

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máximo 10 peticiones
  message: 'Demasiadas peticiones, intenta más tarde'
});

router.post('/', createLimiter, validateCreate, asyncHandler(createProduct));

// ❌ INCORRECTO: Sin rate limiting
router.post('/', (req, res) => {
  // Alguien puede spammear infinitas peticiones
});
```

### 4. **Protección contra SQL Injection**
```javascript
// ✅ CORRECTO: Usar parámetros en queries (mejor-sqlite3)
const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
const product = stmt.get(id); // Parametrizado = seguro

// ❌ INCORRECTO: Concatenar strings en SQL
const product = db.exec(`SELECT * FROM products WHERE id = ${id}`); // VULNERABLE
```

---

## 📝 Estructura de Rutas Profesional

### Archivo: `routes/products.js`

```javascript
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

const {
  validateCreateProduct,
  validateUpdateProduct,
  validateQueryParams
} = require('../middleware/validators');

const { asyncHandler } = require('../middleware/asyncHandler');

// ═══════════════════════════════════════════════════════════════
// RATE LIMITERS - Proteger contra abuse
// ═══════════════════════════════════════════════════════════════

const readLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // 5 minutos
  max: 100,                  // 100 lecturas
  message: 'Demasiadas solicitudes de lectura'
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,                   // 20 escrituras
  message: 'Demasiadas solicitudes de escritura, intenta más tarde'
});

// ═══════════════════════════════════════════════════════════════
// GET ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/products
 * Obtener todos los productos con paginación
 * 
 * @query {number} page - Página (default: 1)
 * @query {number} limit - Items por página (default: 10, max: 50)
 * @query {string} sort - Campo a ordenar (default: -id)
 * 
 * @response 200
 * {
 *   "success": true,
 *   "data": [...],
 *   "pagination": { "total": 100, "page": 1, "limit": 10, "pages": 10 }
 * }
 * 
 * @response 400
 * {
 *   "success": false,
 *   "message": "Parámetros inválidos"
 * }
 */
router.get(
  '/',
  readLimiter,
  validateQueryParams,
  asyncHandler(getAllProducts)
);

/**
 * GET /api/products/:id
 * Obtener un producto específico por ID
 * 
 * @param {number} id - ID del producto
 * 
 * @response 200
 * {
 *   "success": true,
 *   "data": { "id": 1, "name": "Laptop", "price": 999.99 }
 * }
 * 
 * @response 404
 * {
 *   "success": false,
 *   "message": "Producto no encontrado"
 * }
 */
router.get(
  '/:id',
  readLimiter,
  asyncHandler(getProductById)
);

// ═══════════════════════════════════════════════════════════════
// POST ENDPOINT - Crear
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/products
 * Crear un nuevo producto
 * 
 * @body {string} name - Nombre del producto (requerido, max 100)
 * @body {string} description - Descripción (opcional, max 500)
 * @body {number} price - Precio (requerido, > 0)
 * @body {number} stock - Stock disponible (optional, default 0)
 * 
 * @response 201
 * {
 *   "success": true,
 *   "message": "Producto creado exitosamente",
 *   "data": { "id": 1, "name": "Laptop", "price": 999.99 }
 * }
 * 
 * @response 400
 * {
 *   "success": false,
 *   "message": "Errores de validación",
 *   "errors": ["El nombre es requerido", "El precio debe ser positivo"]
 * }
 * 
 * @response 429
 * {
 *   "success": false,
 *   "message": "Demasiadas solicitudes de escritura"
 * }
 */
router.post(
  '/',
  writeLimiter,           // Limitar creaciones
  validateCreateProduct,  // Validar datos
  asyncHandler(createProduct)
);

// ═══════════════════════════════════════════════════════════════
// PUT ENDPOINT - Actualizar
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/products/:id
 * Actualizar un producto existente
 * 
 * @param {number} id - ID del producto
 * @body {string} name - Nombre (opcional)
 * @body {string} description - Descripción (opcional)
 * @body {number} price - Precio (opcional)
 * @body {number} stock - Stock (opcional)
 * 
 * @response 200
 * {
 *   "success": true,
 *   "message": "Producto actualizado exitosamente",
 *   "data": { "id": 1, "name": "Laptop Pro", "price": 1299.99 }
 * }
 * 
 * @response 404
 * {
 *   "success": false,
 *   "message": "Producto no encontrado"
 * }
 */
router.put(
  '/:id',
  writeLimiter,
  validateUpdateProduct,
  asyncHandler(updateProduct)
);

// ═══════════════════════════════════════════════════════════════
// DELETE ENDPOINT - Eliminar
// ═══════════════════════════════════════════════════════════════

/**
 * DELETE /api/products/:id
 * Eliminar un producto
 * 
 * @param {number} id - ID del producto
 * 
 * @response 200
 * {
 *   "success": true,
 *   "message": "Producto eliminado exitosamente"
 * }
 * 
 * @response 404
 * {
 *   "success": false,
 *   "message": "Producto no encontrado"
 * }
 */
router.delete(
  '/:id',
  writeLimiter,
  asyncHandler(deleteProduct)
);

module.exports = router;
```

---

## 🛡️ Validadores Profesionales - `middleware/validators.js`

```javascript
const { ValidationError } = require('../utils/customErrors');

/**
 * Validar parámetros de query (paginación, ordenamiento)
 * 
 * Validaciones incluidas:
 * - page: debe ser número positivo (min: 1)
 * - limit: debe estar entre 1 y 50
 * - sort: solo permite campos permitidos
 * 
 * @returns {Function} Middleware
 */
const validateQueryParams = (req, res, next) => {
  const { page = 1, limit = 10, sort = '-id' } = req.query;
  
  const errors = [];

  // ✅ Validar página
  if (isNaN(page) || page < 1 || !Number.isInteger(Number(page))) {
    errors.push('La página debe ser un número entero positivo');
  }

  // ✅ Validar límite (máximo 50 items)
  if (isNaN(limit) || limit < 1 || limit > 50) {
    errors.push('El límite debe estar entre 1 y 50');
  }

  // ✅ Validar ordenamiento (solo campos permitidos)
  const allowedSortFields = ['id', 'name', 'price', 'stock', 'createdAt'];
  const sortField = sort.replace(/^-/, '');
  
  if (!allowedSortFields.includes(sortField)) {
    errors.push(`Campo de ordenamiento no válido: ${sortField}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Parámetros de query inválidos',
      errors
    });
  }

  // ✅ Pasar valores limpios al siguiente middleware
  req.query.page = Math.max(1, parseInt(page, 10));
  req.query.limit = Math.min(50, parseInt(limit, 10));
  req.query.sort = sort;

  next();
};

/**
 * Validar datos para CREAR producto
 * 
 * Validaciones:
 * - name: requerido, string, no vacío, máx 100 caracteres
 * - price: requerido, número, positivo
 * - stock: opcional, número no negativo
 * 
 * @returns {Function} Middleware
 */
const validateCreateProduct = (req, res, next) => {
  const { name, description, price, stock } = req.body;
  const errors = [];

  // ✅ Validar nombre
  if (!name) {
    errors.push('El nombre es requerido');
  } else if (typeof name !== 'string') {
    errors.push('El nombre debe ser un string');
  } else if (name.trim().length === 0) {
    errors.push('El nombre no puede estar vacío');
  } else if (name.length > 100) {
    errors.push('El nombre no puede exceder 100 caracteres');
  }

  // ✅ Validar descripción (opcional)
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('La descripción debe ser un string');
    } else if (description.length > 500) {
      errors.push('La descripción no puede exceder 500 caracteres');
    }
  }

  // ✅ Validar precio
  if (price === undefined) {
    errors.push('El precio es requerido');
  } else if (typeof price !== 'number') {
    errors.push('El precio debe ser un número');
  } else if (price <= 0) {
    errors.push('El precio debe ser mayor a 0');
  }

  // ✅ Validar stock (opcional)
  if (stock !== undefined) {
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push('El stock debe ser un número entero no negativo');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors
    });
  }

  next();
};

/**
 * Validar datos para ACTUALIZAR producto
 * 
 * Validaciones:
 * - Al menos un campo debe estar presente
 * - Cada campo sigue las mismas reglas que CREATE
 * 
 * @returns {Function} Middleware
 */
const validateUpdateProduct = (req, res, next) => {
  const { name, description, price, stock } = req.body;

  // ✅ Verificar que al menos un campo está presente
  const hasFields = name !== undefined || description !== undefined || 
                   price !== undefined || stock !== undefined;

  if (!hasFields) {
    return res.status(400).json({
      success: false,
      message: 'Debes proporcionar al menos un campo para actualizar'
    });
  }

  const errors = [];

  // ✅ Validar nombre si se proporciona
  if (name !== undefined) {
    if (typeof name !== 'string') {
      errors.push('El nombre debe ser un string');
    } else if (name.trim().length === 0) {
      errors.push('El nombre no puede estar vacío');
    } else if (name.length > 100) {
      errors.push('El nombre no puede exceder 100 caracteres');
    }
  }

  // ✅ Validar descripción si se proporciona
  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push('La descripción debe ser un string');
    } else if (description.length > 500) {
      errors.push('La descripción no puede exceder 500 caracteres');
    }
  }

  // ✅ Validar precio si se proporciona
  if (price !== undefined) {
    if (typeof price !== 'number') {
      errors.push('El precio debe ser un número');
    } else if (price <= 0) {
      errors.push('El precio debe ser mayor a 0');
    }
  }

  // ✅ Validar stock si se proporciona
  if (stock !== undefined) {
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push('El stock debe ser un número entero no negativo');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors
    });
  }

  next();
};

module.exports = {
  validateQueryParams,
  validateCreateProduct,
  validateUpdateProduct
};
```

---

## ⚙️ Middleware Esencial - `middleware/asyncHandler.js`

```javascript
/**
 * AsyncHandler: Wrapper que captura errores en funciones async automáticamente
 * 
 * Evita repetir try-catch en cada controlador
 * Delega manejo de errores al middleware centralizado
 * 
 * @param {Function} fn - Función async a ejecutar
 * @returns {Function} - Middleware que maneja errores automáticamente
 * 
 * Ejemplo:
 * router.get('/', asyncHandler(getAllProducts));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { asyncHandler };
```

---

## 🔧 Configuración de Seguridad - `app.js`

```javascript
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const productRoutes = require('./routes/products');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE GLOBAL DE SEGURIDAD
// ═══════════════════════════════════════════════════════════════

// 1. Parser de JSON (con límite para evitar DoS)
app.use(express.json({ 
  limit: '10kb'  // ✅ Limitar tamaño de payload
}));

// 2. CORS - Controlar acceso desde otros orígenes
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limit Global - Proteger toda la API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                   // máximo 100 peticiones
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde'
});

app.use(globalLimiter);

// 4. Headers de seguridad
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');      // Prevenir MIME sniffing
  res.setHeader('X-Frame-Options', 'DENY');                // Prevenir clickjacking
  res.setHeader('X-XSS-Protection', '1; mode=block');      // XSS protection
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HTTPS
  next();
});

// 5. Logger simple
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════════════════════════════
// RUTAS
// ═══════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/products', productRoutes);

// ═══════════════════════════════════════════════════════════════
// MANEJO DE ERRORES
// ═══════════════════════════════════════════════════════════════

app.use(notFoundHandler);      // 404
app.use(errorHandler);         // Errores globales

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Servidor ejecutándose en puerto ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🔒 Seguridad: Rate limiting, CORS y validación activos`);
  });
}

module.exports = app;
```

---

## 📚 Ejemplos de Uso

### cURL
```bash
# GET todos
curl "http://localhost:3000/api/products?page=1&limit=10&sort=-price"

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

# DELETE
curl -X DELETE "http://localhost:3000/api/products/1"
```

### JavaScript/Fetch
```javascript
// GET todos
const response = await fetch('http://localhost:3000/api/products?page=1&limit=10');
const { success, data, pagination } = await response.json();

// POST crear
const response = await fetch('http://localhost:3000/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Monitor 4K',
    price: 599.99,
    stock: 20
  })
});
const { success, data } = await response.json();

// PUT actualizar
const response = await fetch('http://localhost:3000/api/products/1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ price: 699.99 })
});

// DELETE
await fetch('http://localhost:3000/api/products/1', {
  method: 'DELETE'
});
```

---

## ✅ Checklist de Implementación

- [ ] Crear archivo `routes/products.js` con estructura de rutas
- [ ] Crear archivo `middleware/validators.js` con validadores
- [ ] Crear archivo `middleware/asyncHandler.js`
- [ ] Agregar middlewares de seguridad en `app.js`
- [ ] Configurar rate limiting global
- [ ] Configurar CORS correctamente
- [ ] Crear archivo `.env` con variables
- [ ] Instalar dependencias: `express`, `express-rate-limit`, `cors`, `dotenv`
- [ ] Testear todas las rutas con curl o Postman

---

## 🚀 Próximo Paso

Una vez tengas las **rutas creadas**, usa la skill **`express-crud-handlers-sqlite`** para generar los **controladores** que implementan la lógica CRUD real con validación y sanitización de SQL injection.

