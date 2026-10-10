---
name: backend-transactions-kardex
description: Lógica de negocio atómica del backend - prisma.$transaction, códigos correlativos (ORD-/INV-/CAJA-), movimientos de Kardex que cambian el stock y validación de caja abierta. Úsala al crear compras, ventas, ajustes, mermas, devoluciones, traslados o cualquier flujo que cree un documento con detalle y/o modifique inventario o dinero de caja.
---

# Backend: transacciones, correlativos y Kardex

Cuando una operación toca varias tablas (documento + detalle + stock + bitácora), o todo se guarda o nada. Esta skill reúne las tres piezas que ya usan comandas, ventas y caja, para que un módulo nuevo (compras, mermas, devoluciones...) se comporte igual y el inventario siga cuadrando. Ejemplo completo y compilable en `references/purchase-example.md`.

## 1. Transacciones

```ts
return prisma.$transaction(async (tx) => {
  // aquí dentro, todo con `tx` (nunca con `prisma`)
  const doc = await tx.purchase.create({ /* ... */ });
  // si algo lanza, se revierte TODO lo anterior
  return doc;
});
```

- **Dentro del callback usa solo `tx`.** Usar `prisma` ahí se sale de la transacción y, con un único escritor en SQLite, puede quedarse esperando el bloqueo hasta el timeout.
- Lanza `new Error('CODIGO')` para abortar: el error sale intacto de `$transaction` y el controller lo traduce.
- Valida la entrada **antes** de abrir la transacción (formas, números, arreglos vacíos); haz dentro lo que debe ser consistente con lo que escribes: leer stock, generar el correlativo, comprobar existencia.
- Mantenla corta: sin llamadas de red ni parseo de archivos dentro. El timeout interactivo por defecto es 5 s; para cargas grandes pasa `{ timeout: 30000 }`.
- Borrados con dependientes: borra hijos primero dentro de la misma transacción (como `deleteProduct`/`deleteIngredient`), o mejor, baja lógica.

## 2. Códigos correlativos

| Documento | Formato | Prefijo |
|---|---|---|
| Comanda | `ORD-0001` | `ORD-` |
| Venta | `INV-2026-0001` | `INV-<año>-` |
| Sesión de caja | `CAJA-2026-0001` | `CAJA-<año>-` |
| Nuevo documento | `<SIGLAS>-<año>-0001` (ej. `COM-2026-0001`) | `COM-<año>-` |

Algoritmo (idéntico en los tres servicios actuales): `seq = max(últimoId + 1, últimoSufijoNumérico + 1)`, `padStart(4, '0')`, y mientras el código exista, `seq++`. Usar solo `count` o solo `id` colisiona cuando hay filas borradas o códigos heredados. Genéralo **dentro** de la transacción; el `@unique` del campo es la última defensa (`P2002`).

Hoy el algoritmo está copiado en `order.service.ts`, `sale.service.ts` y `caja.service.ts`. Para documentos nuevos crea (la primera vez que lo necesites) `backend/src/utils/sequence.utils.ts` con `nextSequentialCode` (código en `references/purchase-example.md`) y úsalo; no copies el bucle una cuarta vez ni refactorices los existentes salvo que te lo pidan.

## 3. Kardex: regla de oro

Todo cambio de `Ingredient.currentStock` crea un `InventoryMovement` **en la misma transacción**, calculando `previousStock` y `newStock` de la lectura fresca dentro de `tx`.

| Situación | `type` | `reason` | `reference` sugerida |
|---|---|---|---|
| Compra / entrada de mercancía | `IN` | `PURCHASE` | `Compra COM-2026-0001` |
| Venta de producto con receta | `OUT` | `SALE` | `Order #ORD-0001` (existente) |
| Merma / desperdicio | `OUT` | `WASTE` | `Merma <motivo corto>` |
| Corrección por conteo físico (+) | `IN` | `MANUAL_ADJUSTMENT` | `Manual Adjustment` |
| Corrección por conteo físico (-) | `OUT` | `MANUAL_ADJUSTMENT` | `Manual Adjustment` |
| Anulación de un documento | movimiento **inverso** (`OUT` si el original fue `IN`, y viceversa) | el que corresponda | `Anulación <código>` |

Reglas:
- El Kardex es **append-only**: nunca edites ni borres movimientos para "corregir"; crea uno compensatorio. (Hoy solo se borran al eliminar el insumo.)
- `ADJUSTMENT` existe en el enum pero el backend no lo usa: el signo del delta decide `IN`/`OUT`. Mantén esa convención.
- Decide y documenta si el flujo permite stock negativo. Las ventas hoy sí lo permiten; los ajustes manuales no (`STOCK_CANNOT_BE_NEGATIVE`). Para flujos nuevos que consumen stock (mermas, traslados) bloquea el negativo salvo que el negocio diga lo contrario.
- Los productos `DIRECT_INVENTORY` no tienen stock: no generan movimientos.
- Quién calcula costos: `unitCost` del insumo se sobrescribe con el último costo de compra (no hay promedio ponderado). Si el negocio pide promedio, cámbialo conscientemente y documéntalo.

## 4. Precondiciones frecuentes

- **Caja abierta** (si el flujo mueve dinero del turno):
  ```ts
  const activeCashSession = await tx.cashSession.findFirst({ where: { status: 'OPEN' } });
  if (!activeCashSession) throw new Error('CAJA_CERRADA');
  ```
  y guarda `cashSessionId` en el documento. Mensaje HTTP: el de `order.controller.ts`.
- Entidades referenciadas existen y están activas/disponibles (`PRODUCT_UNAVAILABLE:<nombre>` como patrón).
- Cantidades `> 0` y finitas, ids enteros, importes `>= 0`; redondeo de dinero con `Number(x.toFixed(2))`.
- Líneas duplicadas del mismo insumo son válidas: procésalas en secuencia (cada lectura ve el stock ya actualizado).

## 5. Traducción de errores en el controller

Códigos que lanza el service -> HTTP (patrón del proyecto): referencia del body que no existe -> 400 (`INGREDIENT_NOT_FOUND:<id>` con `startsWith` + `split(':')`); recurso de la URL que no existe -> 404; regla de negocio (`CAJA_CERRADA`, `EMPTY_PURCHASE`, `INVALID_ITEM`) -> 400; `P2002` -> 400; todo lo demás -> 500 con `details: error.message`. Mensajes en español y concretos.

## Terminado cuando

- [ ] Toda escritura multi-tabla está en una sola `$transaction` y solo usa `tx`.
- [ ] Cada cambio de stock tiene su movimiento de Kardex con `previousStock`/`newStock` correctos.
- [ ] El correlativo se genera dentro de la transacción y es único (`@unique` en el modelo + migración).
- [ ] Probaste: éxito, rollback (fuerza un error a mitad: no debe quedar nada guardado), código duplicado y stock insuficiente si aplica.
- [ ] Revisaste en la BD que `ingredients.current_stock` = último `new_stock` del Kardex de cada insumo tocado.
- [ ] `data-model.md`, `api-endpoints.md` e `inventory-kardex.md` actualizados.
