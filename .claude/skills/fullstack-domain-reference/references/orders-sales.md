# Comandas y ventas

Código: `backend/src/services/order.service.ts`, `sale.service.ts`; frontend `frontend/src/app/orders/`.

## Contenido
- Flujo de `POST /api/orders`
- Numeración
- Totales, precios, impuestos y descuentos
- Visibilidad: comandas activas vs. historial
- Eliminación
- `POST /api/sales`
- Frontend

## Flujo de `POST /api/orders`

Todo ocurre en una sola operación (la parte de escritura en `prisma.$transaction`):

1. Exige una `CashSession` con `status = 'OPEN'` -> si no, `CAJA_CERRADA`.
2. Carga los productos pedidos con receta e insumos. Por cada ítem: producto inexistente -> `PRODUCT_NOT_FOUND:<id>`; `available = false` -> `PRODUCT_UNAVAILABLE:<nombre>`.
3. Precio por ítem: `unitPrice` enviado (si es número >= 0, redondeado a 2 decimales) o, si no, `Product.salePrice`. Subtotal = `unitPrice * quantity` redondeado.
4. Transacción: genera `ORD-NNNN` e `INV-AAAA-NNNN`, crea la `Order` (con `cashSessionId`), crea la `Sale` ligada (`paymentMethod` por defecto `CASH`) y **descuenta insumos** registrando `OUT/SALE` en el Kardex.
5. Devuelve `{ ...order, sale }`.

No valida que `quantity` sea entero positivo; un módulo nuevo debe validarlo en el controller.

## Numeración

| Documento | Formato | Origen |
|---|---|---|
| Comanda | `ORD-0001` | `order.service.ts` |
| Venta/factura | `INV-2026-0001` | `order.service.ts` y `sale.service.ts` |
| Sesión de caja | `CAJA-2026-0001` | `caja.service.ts` |

El mismo algoritmo está copiado en tres servicios. Receta y helper recomendado en `backend-transactions-kardex`.

## Totales, precios, impuestos y descuentos

- `Order.total` = **subtotal** (sin impuestos ni descuentos).
- `Sale.total` = `subtotal + tax - discount` (el dashboard suma `Sale.total`).
- El frontend actual no envía `paymentMethod`, `tax` ni `discount`: siempre quedan `CASH`, `0`, `0`.
- El precio unitario puede modificarse por ítem solo para esa venta (`CreateOrderModal` marca el precio editado y permite restaurar el base).

## Visibilidad: comandas activas vs. historial

`Order.active = true` significa "pertenece al turno actual". Al cerrar caja pasan a `false`. `GET /api/orders` sin filtros devuelve solo activas; `scope=all`, `date=YYYY-MM-DD` o `cashSessionId` ofrecen historial. En la UI los **trabajadores** siempre usan `scope=active`; el **admin** puede elegir Turno actual / Por fecha / Todas.

## Eliminación

`DELETE /api/orders/:id` borra la venta asociada y la comanda (los detalles caen por cascade). **No** restituye stock ni toca la caja. Si cambias esto, usa movimientos compensatorios en el Kardex.

## `POST /api/sales`

Ruta alternativa para facturar una comanda existente (`orderId`) o una venta directa (`items`). No exige caja abierta ni descuenta stock, y no la usa la UI actual. Si la comanda ya tiene venta responde 400 (índice único `orderId`).

## Frontend

| Archivo | Rol |
|---|---|
| `OrdersPage.jsx` | carga comandas + estado de caja; antes de abrir `CreateOrderModal` consulta `GET /api/caja/status` y muestra "Caja Cerrada" si corresponde |
| `OrderHeaderCard.jsx` | título + indicador de caja, búsqueda, filtros de admin, métricas (cantidad y total de ventas) |
| `CreateOrderModal.jsx` | catálogo (carga `available=true` al abrir) + carrito con notas por ítem y precio editable |
| `OrderCard.jsx` / `OrderDetailModal.jsx` | tarjeta con vista previa y ticket de detalle |
| `OrderStatusSwitcher.jsx` | **sin usar** (código muerto) |
