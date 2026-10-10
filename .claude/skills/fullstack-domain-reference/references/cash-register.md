# Caja registradora (turnos y arqueos)

Reemplaza a la skill antigua `cash-register-session-management`. Código: `backend/src/services/caja.service.ts`, `controllers/caja.controller.ts`, `routes/caja.routes.ts`; frontend `frontend/src/app/caja/`.

## Contenido
- Propósito y límites
- Reglas e invariantes
- Denominaciones
- Ciclo de vida y estados
- Numeración y auditoría
- Frontend
- Cómo integrar un módulo nuevo con la caja

## Propósito y límites

Controla **solo** la apertura (base inicial para dar cambio) y el cierre (conteo físico final) del turno. **No cobra ni factura**: las ventas se crean desde las comandas (`orders-sales.md`).

## Reglas e invariantes

1. Solo puede haber **una** sesión `OPEN`. Lo garantiza el service (`SESSION_ALREADY_OPEN`), no un índice de BD.
2. `POST /api/orders` exige una sesión `OPEN` (`CAJA_CERRADA` si no); la comanda guarda `cashSessionId`.
3. **Cerrar caja archiva comandas**: en la misma transacción `order.updateMany({ where: { active: true }, data: { active: false } })` (todas las activas, no solo las de la sesión) y luego actualiza la sesión.
4. `initialAmount` y `finalAmount` se **calculan en el backend** a partir de las denominaciones (nunca confíes en un total enviado por el cliente al abrir/cerrar).
5. `PUT /api/caja/:id` (edición administrativa) cambia montos y notas, **no** los desgloses: tras editarlos, el total y el desglose pueden diferir. Úsalo solo para correcciones.
6. Auditoría: `openedByUserId` / `closedByUserId` salen del campo `userId` del body (el frontend envía `user.id`). El servidor no lo verifica.

## Denominaciones

- Formato de entrada: objeto `{ "0.05": 10, "0.10": 20, "1": 30, "20": 2 }` (valor -> cantidad) **o** arreglo `[{ value: 0.5, count: 10 }]`.
- `calculateDenominationsTotal` (privado en `CajaService`): descarta valores <= 0 y cantidades <= 0, normaliza la clave con `parseFloat(...).toString()` (`"1.00"` -> `"1"`), suma `valor * cantidad` y redondea a 2 decimales. Devuelve `{ total, normalized }`.
- Se guarda `JSON.stringify(normalized)` en `initialDenominations` / `finalDenominations` (strings). Las respuestas devuelven objetos ya parseados (con `try/catch` por si hay JSON corrupto).
- Catálogo del frontend (`caja/utils/cajaUtils.js#CASH_DENOMINATIONS`): monedas 0.05, 0.10, 0.25, 0.50, 1.00 y billetes 2, 5, 10, 20, 50, 100 (USD). Si cambia la moneda, cambia aquí y en los formateadores.
- `SessionDetailModal` muestra `count x $valor`; para claves sin punto añade `.00`.

## Ciclo de vida y estados

```
(no hay sesión) --open--> OPEN --close (mismo día calendario)--> CLOSED
                                 └─close (otro día calendario)--> LATE_CLOSED
```

`LATE_CLOSED` = cerrada un día calendario distinto al de apertura (hora local del servidor). Ambos estados cuentan como "finalizada"; el frontend comprueba `status === 'CLOSED' || status === 'LATE_CLOSED'`.

`GET /api/caja/status`: abierta -> `{ isOpen: true, activeSession }`; cerrada -> `{ isOpen: false, activeSession: null, lastClosedSession }`.

## Numeración y auditoría

`CAJA-<año>-<secuencia de 4 dígitos>` (ej. `CAJA-2026-0001`). Algoritmo: `max(últimoId + 1, últimoSufijo + 1)` y reintento mientras exista (ver skill `backend-transactions-kardex`). Las respuestas incluyen `openedByUser` / `closedByUser` con `{ id, fullName, username }`.

## Frontend

| Archivo | Rol |
|---|---|
| `CajaPage.jsx` | carga `status` + `history(limit 100)` y, si es admin, la lista de usuarios; filtra por texto y por empleado |
| `CajaStatusBanner.jsx` | banner verde (turno en curso) o gris (caja cerrada + último cierre) con acciones |
| `OpenCajaModal.jsx` / `CloseCajaModal.jsx` | conteo por denominación con botones rápidos (+/- 5 monedas, +/- 1 billetes). Abrir exige total > 0; cerrar pide `confirmDialog` antes de enviar |
| `SessionHistoryTable.jsx` | tabla con `Pagination` (15 por página, en cliente) |
| `SessionDetailModal.jsx` | desglose de apertura y cierre |
| `EditCajaSessionModal.jsx` | solo admin: montos y notas (`finalAmount` solo si está cerrada) |

El bloque de conteo de monedas/billetes está **duplicado** en Open y Close; si tocas uno, extrae un componente `DenominationCounter` y úsalo en ambos.

## Cómo integrar un módulo nuevo con la caja

Si el módulo mueve dinero del turno (gastos, retiros, propinas, etc.):
1. En el service, busca la sesión `OPEN` (`prisma.cashSession.findFirst({ where: { status: 'OPEN' } })`) y lanza `new Error('CAJA_CERRADA')` si no existe; el controller lo traduce a 400 con el mismo mensaje que usa `order.controller.ts`.
2. Guarda `cashSessionId` en el documento nuevo (agrega la relación inversa en `CashSession`).
3. Decide si el cierre debe archivar/consolidar esos registros (como `orders.active`) y, si es así, hazlo en la transacción de `closeSession`.
4. Si el cierre debe mostrar totales esperados vs. contados, calcúlalos en el service y devuélvelos en la respuesta de cierre; hoy el cierre no compara contra ventas en efectivo.
5. En el frontend, consulta `fetchCajaStatusForOrders()`-style (`GET /api/caja/status`) antes de abrir el formulario y muestra el aviso "Caja Cerrada" con `showErrorAlert`.
