# Comandas y ventas

Código: `backend/src/services/order.service.ts`, `sale.service.ts`, `utils/sale.utils.ts`, `utils/sequence.utils.ts`; frontend `frontend/src/app/orders/`.

## Contenido
- Flujo de `POST /api/orders`
- Numeración
- Totales, precios, impuestos y descuentos
- Visibilidad: comandas activas vs. historial, y qué ve cada rol
- Eliminación y devolución de stock
- `POST /api/sales`
- Frontend

## Flujo de `POST /api/orders`

Todo ocurre en una sola operación (la validación de entrada va antes y la escritura en `prisma.$transaction`):

0. Antes de abrir la transacción: `assertValidItems` (cada línea con `productId` entero positivo y `quantity` **entera mayor a 0**; si no, `INVALID_ITEM` -> 400), `normalizePaymentMethod` (vacío = `CASH`; fuera de `CASH|CARD|TRANSFER|MIXED` -> `INVALID_PAYMENT_METHOD`) y `normalizeAmount` para `tax` y `discount` (vacío = 0; no numérico o negativo -> `INVALID_AMOUNT`).
1. Exige una `CashSession` con `status = 'OPEN'` -> si no, `CAJA_CERRADA`.
2. Carga los productos pedidos con receta e insumos. Por cada ítem: producto inexistente -> `PRODUCT_NOT_FOUND:<id>`; `available = false` -> `PRODUCT_UNAVAILABLE:<nombre>`.
3. Precio por ítem: `unitPrice` enviado (si es número >= 0, redondeado a 2 decimales) o, si no, `Product.salePrice`. Subtotal = `unitPrice * quantity` redondeado.
4. **Valida el stock antes de escribir nada**: suma lo que necesita toda la comanda por insumo y lo compara con el stock leído dentro de la transacción. Si algún insumo no alcanza, 400 `{ error, shortages: [{ ingredientId, name, measurementUnit, needed, available }] }` y no se crea ni se descuenta nada.
5. Genera `ORD-NNNN` e `INV-AAAA-NNNN` (`utils/sequence.utils.ts`), crea la `Order` (con `cashSessionId`), crea la `Sale` ligada (`paymentMethod` por defecto `CASH`) y **descuenta insumos** registrando `OUT/SALE` en el Kardex.
6. Devuelve `{ ...order, sale }`.

Los productos `DIRECT_INVENTORY` no tienen receta: venderlos no descuenta nada (`known-issues.md`, B7).

## Numeración

| Documento | Formato | Origen |
|---|---|---|
| Comanda | `ORD-0001` | `nextOrderNumber` (`utils/sequence.utils.ts`) |
| Venta/factura | `INV-2026-0001` | `nextInvoiceNumber` (`order.service.ts` y `sale.service.ts`) |
| Sesión de caja | `CAJA-2026-0001` | `nextCashSessionNumber` (`caja.service.ts`) |

Los tres usan el mismo algoritmo (`nextSequentialCode`); para un documento nuevo, receta en `backend-transactions-kardex`.

## Totales, precios, impuestos y descuentos

- `Order.total` = **subtotal** (sin impuestos ni descuentos).
- `Sale.total` = `subtotal + tax - discount` (el dashboard suma `Sale.total`).
- El frontend actual no envía `paymentMethod`, `tax` ni `discount`: siempre quedan `CASH`, `0`, `0`.
- El precio unitario puede modificarse por ítem solo para esa venta (`CreateOrderModal` marca el precio editado y permite restaurar el base). **El servidor acepta `unitPrice`, `tax` y `discount` de cualquier usuario autenticado, también de un WORKER** (riesgo de fraude abierto: `known-issues.md`, R1).

## Visibilidad: comandas activas vs. historial, y qué ve cada rol

`Order.active = true` significa "pertenece al turno actual". Al cerrar caja pasan a `false`. `GET /api/orders` sin filtros devuelve solo activas; `scope=all`, `date=YYYY-MM-DD` o `cashSessionId` ofrecen historial. **El servidor limita al WORKER al turno actual**: `scope=all`, cualquier `date` o un `cashSessionId` distinto de la caja abierta responden 403, y `GET`/`DELETE /api/orders/:id` de una comanda ya archivada también (403). El ADMIN accede a todo. En la UI los trabajadores siempre usan `scope=active`; el admin puede elegir Turno actual / Por fecha / Todas.

## Eliminación y devolución de stock

`DELETE /api/orders/:id` borra la venta asociada y la comanda (los detalles caen por cascade) **y devuelve el stock** en la misma transacción: por cada insumo consumido crea un movimiento `IN` / `MANUAL_ADJUSTMENT` con referencia `Anulación Order #ORD-xxxx` (se devuelve lo que realmente salió del Kardex con esa referencia desde que nació la comanda, no lo que diga la receta hoy). Funciona aunque la comanda esté archivada; un WORKER solo puede borrar las del turno actual. No toca la caja. Una comanda borrada no deja rastro de quién la creó ni quién la borró (`Order` no guarda usuario: `known-issues.md`, R2).

## `POST /api/sales`

Ruta alternativa para facturar una comanda existente (`orderId`) o una venta directa (`items`). **Solo ADMIN.** No exige caja abierta ni descuenta stock, y no la usa la UI actual. Valida ítems, importes y forma de pago (400). Si la comanda ya tiene venta responde 400 (índice único `orderId`).

## Frontend

| Archivo | Rol |
|---|---|
| `OrdersPage.jsx` | carga comandas + estado de caja; antes de abrir `CreateOrderModal` consulta `GET /api/caja/status` y muestra "Caja Cerrada" si corresponde |
| `OrderHeaderCard.jsx` | título + indicador de caja, búsqueda, filtros de admin, métricas (cantidad y total de ventas) |
| `CreateOrderModal.jsx` | catálogo (carga `available=true` al abrir) + carrito con notas por ítem y precio editable; muestra el mensaje del servidor si falta stock |
| `OrderCard.jsx` / `OrderDetailModal.jsx` | tarjeta con vista previa y ticket de detalle |
