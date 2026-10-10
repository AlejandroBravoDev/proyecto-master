# Ejemplo completo: módulo de Compras (documento + detalle + stock + Kardex)

Supone que ya existe el módulo `Supplier` (ver `backend-new-module/references/templates.md`). Muestra el flujo completo: modelo -> migración -> helper de correlativos -> service transaccional -> controller -> ruta.

## Contenido
- Modelo Prisma
- Migración
- Helper de correlativos
- Service
- Controller
- Routes y registro
- Pruebas

## Modelo Prisma

```prisma
// backend/prisma/schema.prisma (agregar)
model Purchase {
  id         Int              @id @default(autoincrement())
  number     String           @unique                       // COM-2026-0001
  supplierId Int              @map("supplier_id")
  notes      String?
  total      Float            @default(0.0)
  date       DateTime         @default(now())
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")

  supplier   Supplier         @relation(fields: [supplierId], references: [id])
  details    PurchaseDetail[]

  @@index([supplierId])
  @@map("purchases")
}

model PurchaseDetail {
  id           Int        @id @default(autoincrement())
  purchaseId   Int        @map("purchase_id")
  ingredientId Int        @map("ingredient_id")
  quantity     Float
  unitCost     Float      @map("unit_cost")
  subtotal     Float

  purchase     Purchase   @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id])

  @@index([purchaseId])
  @@index([ingredientId])
  @@map("purchase_details")
}
```

Campos inversos obligatorios: en `Supplier` agrega `purchases Purchase[]` y en `Ingredient` agrega `purchaseDetails PurchaseDetail[]`.

## Migración

Bloque `004_purchases` en `init.ts` (plantillas en `backend-db-migration`):

```sql
CREATE TABLE IF NOT EXISTS "purchases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "notes" TEXT,
    "total" REAL NOT NULL DEFAULT 0.0,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_number_key" ON "purchases"("number");
CREATE INDEX IF NOT EXISTS "purchases_supplier_id_idx" ON "purchases"("supplier_id");

CREATE TABLE IF NOT EXISTS "purchase_details" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "purchase_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "quantity" REAL NOT NULL,
    "unit_cost" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "purchase_details_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "purchase_details_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "purchase_details_purchase_id_idx" ON "purchase_details"("purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_details_ingredient_id_idx" ON "purchase_details"("ingredient_id");
```

## Helper de correlativos

Créalo una sola vez, la primera vez que un documento nuevo lo necesite.

```ts
// backend/src/utils/sequence.utils.ts
/**
 * ====================================================
 * GENERADOR DE CÓDIGOS CORRELATIVOS
 * ====================================================
 * Genera códigos tipo "COM-2026-0001" sin colisiones, incluso si hay
 * registros eliminados o códigos heredados. Debe invocarse DENTRO de la
 * transacción que crea el documento.
 */

export interface SequenceOptions {
  /** Prefijo fijo, p. ej. "ORD-" o "INV-2026-" */
  prefix: string;
  /** Devuelve el último registro (por id) con su código, o null si no hay registros */
  getLast: () => Promise<{ id: number; code: string | null } | null>;
  /** Indica si un código ya está en uso */
  exists: (code: string) => Promise<boolean>;
  /** Cantidad de dígitos del correlativo (por defecto 4) */
  pad?: number;
}

export async function nextSequentialCode({
  prefix,
  getLast,
  exists,
  pad = 4
}: SequenceOptions): Promise<string> {
  const last = await getLast();

  let seq = (last?.id ?? 0) + 1;
  const match = last?.code?.match(/(\d+)$/);
  if (match) {
    const lastNum = parseInt(match[1], 10);
    if (!isNaN(lastNum)) {
      seq = Math.max(seq, lastNum + 1);
    }
  }

  let code = `${prefix}${String(seq).padStart(pad, '0')}`;
  while (await exists(code)) {
    seq++;
    code = `${prefix}${String(seq).padStart(pad, '0')}`;
  }

  return code;
}
```

## Service

```ts
// backend/src/services/purchase.service.ts
/**
 * ====================================================
 * SERVICIO DE COMPRAS (MODEL/SERVICE LAYER)
 * ====================================================
 * Registra compras a proveedores: crea el documento con su detalle,
 * incrementa el stock de los insumos y deja el rastro en el Kardex,
 * todo dentro de una única transacción.
 */

import prisma from '../prisma/client';
import { nextSequentialCode } from '../utils/sequence.utils';

export interface PurchaseItemInput {
  ingredientId: number;
  quantity: number;
  unitCost: number;
}

export class PurchaseService {
  /**
   * Lista las compras, las más recientes primero.
   */
  async getAllPurchases() {
    return prisma.purchase.findMany({
      include: { supplier: true, details: { include: { ingredient: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Obtiene una compra por ID (null si no existe).
   * @param id ID de la compra
   */
  async getPurchaseById(id: number) {
    return prisma.purchase.findUnique({
      where: { id },
      include: { supplier: true, details: { include: { ingredient: true } } }
    });
  }

  /**
   * Registra una compra y entra el stock al inventario de forma atómica.
   * @param data Proveedor, notas opcionales y líneas (insumo, cantidad, costo unitario)
   */
  async createPurchase(data: { supplierId: number; notes?: string; items: PurchaseItemInput[] }) {
    // 1. Validación de entrada (antes de abrir la transacción)
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('EMPTY_PURCHASE');
    }
    for (const item of data.items) {
      if (!Number.isInteger(item.ingredientId) || !(item.quantity > 0) || !(item.unitCost >= 0)) {
        throw new Error('INVALID_ITEM');
      }
    }

    // 2. Todo lo que escribe va en una sola transacción y usa únicamente `tx`
    return prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier) {
        throw new Error('SUPPLIER_NOT_FOUND');
      }
      if (!supplier.active) {
        throw new Error('SUPPLIER_INACTIVE');
      }

      // 2b. Todos los insumos deben existir ANTES de crear nada: si no, la FK de purchase_details
      //     falla con P2003 al crear el detalle y el error llega opaco al cliente.
      const ingredientIds = [...new Set(data.items.map((item) => item.ingredientId))];
      const existing = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true }
      });
      const existingIds = new Set(existing.map((i) => i.id));
      const missingId = ingredientIds.find((id) => !existingIds.has(id));
      if (missingId !== undefined) {
        throw new Error(`INGREDIENT_NOT_FOUND:${missingId}`);
      }

      // 3. Código correlativo único (COM-AAAA-NNNN)
      const year = new Date().getFullYear();
      const number = await nextSequentialCode({
        prefix: `COM-${year}-`,
        getLast: async () => {
          const last = await tx.purchase.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true, number: true }
          });
          return last ? { id: last.id, code: last.number } : null;
        },
        exists: async (code) =>
          (await tx.purchase.findUnique({ where: { number: code }, select: { id: true } })) !== null
      });

      // 4. Cabecera y detalle
      const details = data.items.map((item) => ({
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        subtotal: Number((item.quantity * item.unitCost).toFixed(2))
      }));
      const total = Number(details.reduce((acc, d) => acc + d.subtotal, 0).toFixed(2));

      const purchase = await tx.purchase.create({
        data: {
          number,
          supplierId: data.supplierId,
          notes: data.notes?.trim() || null,
          total,
          details: { create: details }
        },
        include: { supplier: true, details: { include: { ingredient: true } } }
      });

      // 5. Stock + Kardex por línea (cada lectura ve el stock ya actualizado)
      for (const item of data.items) {
        const ingredient = await tx.ingredient.findUnique({ where: { id: item.ingredientId } });
        if (!ingredient) {
          throw new Error(`INGREDIENT_NOT_FOUND:${item.ingredientId}`);
        }

        const previousStock = ingredient.currentStock;
        const newStock = previousStock + item.quantity;

        await tx.ingredient.update({
          where: { id: ingredient.id },
          data: { currentStock: newStock, unitCost: item.unitCost }
        });

        await tx.inventoryMovement.create({
          data: {
            ingredientId: ingredient.id,
            type: 'IN',
            reason: 'PURCHASE',
            quantity: item.quantity,
            previousStock,
            newStock,
            reference: `Compra ${number}`
          }
        });
      }

      return purchase;
    });
  }
}

export const purchaseService = new PurchaseService();
```

## Controller

```ts
// backend/src/controllers/purchase.controller.ts
/**
 * ====================================================
 * CONTROLADOR DE COMPRAS (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP de compras a proveedores.
 */

import { Request, Response } from 'express';
import { purchaseService } from '../services/purchase.service';

export class PurchaseController {
  /**
   * GET /api/purchases
   * Lista las compras registradas.
   */
  async getPurchases(_req: Request, res: Response) {
    try {
      const purchases = await purchaseService.getAllPurchases();
      return res.json(purchases);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener las compras', details: error.message });
    }
  }

  /**
   * GET /api/purchases/:id
   * Retorna el detalle de una compra.
   */
  async getPurchaseById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID de compra inválido' });
      }

      const purchase = await purchaseService.getPurchaseById(id);
      if (!purchase) {
        return res.status(404).json({ error: 'Compra no encontrada' });
      }

      return res.json(purchase);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener la compra', details: error.message });
    }
  }

  /**
   * POST /api/purchases
   * Registra una compra, entra el stock y deja el rastro en el Kardex.
   */
  async createPurchase(req: Request, res: Response) {
    try {
      const { supplierId, notes, items } = req.body ?? {};

      if (!Number.isInteger(Number(supplierId))) {
        return res.status(400).json({ error: 'El proveedor (supplierId) es obligatorio' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La compra debe incluir al menos un insumo' });
      }

      const purchase = await purchaseService.createPurchase({
        supplierId: Number(supplierId),
        notes: typeof notes === 'string' ? notes : undefined,
        items: items.map((item: any) => ({
          ingredientId: Number(item.ingredientId),
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost)
        }))
      });

      return res.status(201).json(purchase);
    } catch (error: any) {
      const code: string = error.message || '';

      if (code === 'EMPTY_PURCHASE') {
        return res.status(400).json({ error: 'La compra debe incluir al menos un insumo' });
      }
      if (code === 'INVALID_ITEM') {
        return res.status(400).json({ error: 'Cada línea requiere un insumo válido, cantidad mayor a 0 y costo unitario mayor o igual a 0' });
      }
      if (code === 'SUPPLIER_NOT_FOUND') {
        return res.status(400).json({ error: 'El proveedor indicado no existe' });
      }
      if (code === 'SUPPLIER_INACTIVE') {
        return res.status(400).json({ error: 'El proveedor indicado está inactivo' });
      }
      if (code.startsWith('INGREDIENT_NOT_FOUND:')) {
        return res.status(400).json({ error: `Insumo ID ${code.split(':')[1]} no encontrado` });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'No se pudo generar un código único para la compra, inténtalo de nuevo' });
      }
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Alguna referencia de la compra (proveedor o insumo) no es válida' });
      }
      return res.status(500).json({ error: 'Error al registrar la compra', details: error.message });
    }
  }
}

export const purchaseController = new PurchaseController();
```

## Routes y registro

```ts
// backend/src/routes/purchase.routes.ts
/**
 * ====================================================
 * RUTAS DE COMPRAS (ROUTER LAYER)
 * ====================================================
 */

import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller';

const router = Router();

// Endpoint GET: Lista las compras registradas
router.get('/', (req, res) => purchaseController.getPurchases(req, res));

// Endpoint GET: Detalle de una compra
router.get('/:id', (req, res) => purchaseController.getPurchaseById(req, res));

// Endpoint POST: Registra una compra (suma stock y registra Kardex)
router.post('/', (req, res) => purchaseController.createPurchase(req, res));

export default router;
```

Registro en `routes/index.ts`: `import purchaseRoutes from './purchase.routes';` y `router.use('/purchases', purchaseRoutes);`.

## Pruebas

`api.mjs` acepta JSON "relajado" en `--json` (claves sin comillas), así el mismo comando funciona en PowerShell, cmd y bash sin escapar comillas.

```bash
# con un proveedor (id 1) y un insumo (id 1) ya creados:
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/purchases --json "{supplierId:1,items:[{ingredientId:1,quantity:5,unitCost:0.6}]}"
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/ingredients/1      # currentStock subió y aparece el movimiento IN/PURCHASE
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/purchases supplierId=1   # sin items -> 400
```

Prueba de rollback: envía una segunda línea con un `ingredientId` inexistente (`items:[{ingredientId:1,quantity:5,unitCost:1},{ingredientId:9999,quantity:1,unitCost:1}]`); la respuesta debe ser 400 y **ni la compra ni el stock de la primera línea** deben haber cambiado.
