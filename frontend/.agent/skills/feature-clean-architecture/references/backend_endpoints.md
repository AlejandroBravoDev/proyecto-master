# Backend POS API - Technical Specification & Endpoints Guide

All API requests must use the base URL from `VITE_API_URL` (port 3001) with the `/api` prefix. Requests with a body (`POST`, `PUT`) must include `Content-Type: application/json`.

---

## 🏥 Health Check

### `GET /health`
Server status check.
- **Query Params**: None
- **Response (`200 OK`)**:
  ```json
  {
    "status": "OK",
    "timestamp": "2026-08-29T22:45:00.000Z"
  }
  ```

---

## 📊 1. Dashboard y KPIs (`/api/dashboard`)

### `GET /api/dashboard/kpis`
Global real-time metrics for Dashboard.
- **Query Params (Optional)**:
  - `period`: `'day'` | `'month'` | `'year'` (Default: `'day'`)
- **Response (`200 OK`)**:
  ```json
  {
    "period": "day",
    "totalRevenue": 20.22,
    "totalItemsSold": 3,
    "grossProfit": 14.51,
    "stockAlertsCount": 2,
    "topSellingProducts": [
      { "id": 1, "name": "Hamburguesa con Queso", "totalSold": 2 },
      { "id": 2, "name": "Café Cappuccino", "totalSold": 1 }
    ],
    "criticalStockIngredients": [
      {
        "id": 1,
        "name": "Carne de Res 150g",
        "currentStock": 2,
        "minimumStock": 10,
        "measurementUnit": "unidad",
        "percentageRemaining": 20
      }
    ]
  }
  ```

---

## 🏷️ 2. Categorías (`/api/categories`)

- `GET /api/categories`: List all categories.
- `GET /api/categories/:id`: Get category detail by ID.
- `POST /api/categories`: Create category `{ "name": "Bebidas", "description": "..." }`.
- `PUT /api/categories/:id`: Update category `{ "name": "...", "description": "..." }`.
- `DELETE /api/categories/:id`: Delete category by ID.

---

## 🍔 3. Productos (`/api/products`)

- `GET /api/products`: List products.
  - **Query Params (Optional)**:
    - `categoryId`: (Number) Filter by category.
    - `available`: `true` | `false`
    - `productType`: `'PREPARED'` | `'DIRECT_INVENTORY'`
- `GET /api/products/:id`: Get product detail including recipe & ingredients.
- `POST /api/products`: Create product (optionally with recipe):
  ```json
  {
    "categoryId": 1,
    "name": "Hamburguesa Doble",
    "description": "...",
    "salePrice": 15.00,
    "image": null,
    "available": true,
    "productType": "PREPARED",
    "recipe": {
      "name": "Receta Hamburguesa Doble",
      "ingredients": [
        { "ingredientId": 1, "quantity": 0.30, "measurementUnit": "kg" }
      ]
    }
  }
  ```
- `PUT /api/products/:id`: Update product properties `{ "salePrice": 16.50, "available": false }`.
- `DELETE /api/products/:id`: Delete product by ID.

---

## 🥩 4. Insumos y Materias Primas (`/api/ingredients`)

- `GET /api/ingredients`: List raw materials/ingredients.
- `GET /api/ingredients/:id`: Detail & last 20 Kardex inventory movements.
- `POST /api/ingredients`: Create ingredient:
  ```json
  {
    "name": "Pan de Hamburguesa",
    "description": "Pan Brioche",
    "measurementUnit": "unidad",
    "currentStock": 50,
    "minimumStock": 10,
    "unitCost": 0.50
  }
  ```
- `PUT /api/ingredients/:id`: Update info or manual stock adjustment:
  ```json
  {
    "minimumStock": 15,
    "unitCost": 0.55,
    "adjustStock": 20,
    "adjustReason": "PURCHASE"
  }
  ```
  - `adjustReason`: `'PURCHASE'` | `'SALE'` | `'WASTE'` | `'MANUAL_ADJUSTMENT'`
- `DELETE /api/ingredients/:id`: Delete ingredient by ID.

---

## 📖 5. Recetas y Formulación (`/api/recipes`)

- `GET /api/recipes`: List all recipes with ingredient details.
- `GET /api/recipes/product/:productId`: Get recipe for product ID.
- `POST /api/recipes`: Create or replace recipe for a product:
  ```json
  {
    "productId": 1,
    "name": "Receta Hamburguesa Clásica",
    "ingredients": [
      { "ingredientId": 1, "quantity": 0.15, "measurementUnit": "kg" }
    ]
  }
  ```
- `DELETE /api/recipes/:id`: Delete recipe by ID.

---

## 📝 6. Comandas y Pedidos (`/api/orders`)

- `GET /api/orders`: Order history.
- `GET /api/orders/:id`: Full order detail.
- `POST /api/orders`: Create kitchen/bar order (automatically deducts ingredient stock):
  ```json
  {
    "notes": "Mesa 4 - Sin cebolla",
    "items": [
      { "productId": 1, "quantity": 2, "notes": "Bien cocida" },
      { "productId": 3, "quantity": 1 }
    ]
  }
  ```
- `DELETE /api/orders/:id`: Cancel order.

---

## 💳 7. Ventas y Facturación (`/api/sales`)

- `GET /api/sales`: Sales & invoice history.
- `GET /api/sales/:id`: Detail of a sale/invoice.
- `POST /api/sales`: Issue invoice.
  - **Option A (From Order)**:
    ```json
    {
      "orderId": 1,
      "paymentMethod": "CASH",
      "tax": 1.50,
      "discount": 0.00
    }
    ```
  - **Option B (Direct Sale at Cashier)**:
    ```json
    {
      "paymentMethod": "CARD",
      "tax": 2.00,
      "discount": 1.00,
      "items": [
        { "productId": 1, "quantity": 1, "unitPrice": 12.50 }
      ]
    }
    ```
  - **Payment Methods**: `'CASH'`, `'CARD'`, `'TRANSFER'`, `'MIXED'`

---

## 📦 8. Kardex e Inventario (`/api/inventory`)

- `GET /api/inventory/movements`: Kardex movement logs.
  - **Query Params (Optional)**:
    - `ingredientId`: Filter by ingredient ID.
    - `type`: `'IN'` | `'OUT'` | `'ADJUSTMENT'`
    - `reason`: `'PURCHASE'` | `'SALE'` | `'WASTE'` | `'MANUAL_ADJUSTMENT'`
- `GET /api/inventory/alerts`: List of ingredients with current stock <= minimum stock.
