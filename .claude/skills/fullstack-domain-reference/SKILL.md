---
name: fullstack-domain-reference
description: Referencia verificada del POS MasterFood - arquitectura, modelo de datos, catálogo de endpoints /api, reglas de caja (apertura/cierre/denominaciones), kardex e inventario, comandas y ventas, usuarios/roles y problemas conocidos. Consúltala ANTES de tocar o extender caja, inventario, comandas, ventas, usuarios o dashboard, y siempre que pregunten cómo funciona algo del sistema o qué endpoints existen.
---

# MasterFood POS - referencia de dominio

Hechos verificados contra el código (octubre 2026). Aquí no hay procesos paso a paso (para eso están las skills `backend-*`, `frontend-*` y `fullstack-*`); esta skill evita que adivines cómo funciona el sistema. Lee el archivo que corresponda y respeta las reglas que describe.

> Si el código contradice un archivo de esta skill, **gana el código**: corrige la referencia en el mismo cambio. Mantener esto al día forma parte de "terminado" en cualquier tarea.

## Qué es el sistema

Monorepo con dos apps npm independientes (no hay `package.json` en la raíz):

- `backend/` - Express 5 + TypeScript + Prisma 7 sobre SQLite (adapter better-sqlite3). API REST bajo `/api`.
- `frontend/` - React 19 + Vite 8 + Tailwind 4, SPA con `createHashRouter`. UI en español.

En producción **un solo proceso Node** sirve la API y el SPA compilado (`frontend/dist`).

## Qué leer según la tarea

| Vas a... | Lee |
|---|---|
| Entender estructura, scripts, variables de entorno, arranque, ruta de la BD | `references/architecture.md` |
| Agregar o cambiar tablas, campos o relaciones | `references/data-model.md` |
| Consumir o crear endpoints (contrato de request/response/errores) | `references/api-endpoints.md` |
| Tocar apertura/cierre de caja, denominaciones, turnos | `references/cash-register.md` |
| Tocar insumos, stock, Kardex, recetas, plantillas Excel | `references/inventory-kardex.md` |
| Tocar comandas, ventas, numeración, precios | `references/orders-sales.md` |
| Tocar login, usuarios, roles, permisos | `references/users-roles.md` |
| Vas a copiar un patrón existente y dudas si es buen ejemplo o legado | `references/known-issues.md` |

## Reglas transversales (las que más se rompen)

1. **Forma de las respuestas**: éxito = JSON crudo (objeto o array, sin envoltorio `{success, data}`); borrado = `{ message }`; error = `{ error: "mensaje en español", details? }`. El frontend lee `errorData.error`.
2. **La BD no se migra con `prisma migrate`**: el esquema físico lo crea `backend/src/prisma/init.ts` al arrancar. Cambiar `schema.prisma` sin añadir la migración allí rompe cualquier BD nueva (skill `backend-db-migration`).
3. **Sin caja abierta no hay comandas**: `POST /api/orders` falla con `CAJA_CERRADA`. Cerrar caja archiva las comandas activas.
4. **Todo cambio de stock deja un movimiento de Kardex** en la misma transacción (skill `backend-transactions-kardex`).
5. **No hay autenticación en el servidor**: los roles solo se aplican en la UI. No existe `req.user`; la caja recibe `userId` en el body. Avisa al usuario si una tarea depende de seguridad real.
6. **Idioma**: textos de UI, mensajes de error y comentarios del backend en español; identificadores y JSDoc del frontend en inglés; commits en inglés.
7. **Moneda**: montos en USD con `Float`; redondea con `Number(x.toFixed(2))` antes de guardar o sumar.
