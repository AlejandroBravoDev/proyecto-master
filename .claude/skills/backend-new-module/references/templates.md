# Plantillas de módulo backend (ejemplo: Supplier / proveedores)

Reemplaza `Supplier` -> tu entidad, `supplier` -> instancia/archivo, `suppliers` -> plural/URL/tabla, y ajusta los campos. La primera línea de cada bloque indica la ruta del archivo.

## Contenido
- Modelo Prisma
- Service
- Controller
- Routes
- Registro en el router maestro
- Variante: paginación en servidor
- Variante: filtros tipados
- Pruebas rápidas

## Modelo Prisma

Agrega al final de `backend/prisma/schema.prisma` y crea la migración con la skill `backend-db-migration`.

```prisma
// backend/prisma/schema.prisma (agregar al final)
// ----------------------------------------------------
// 12. Proveedores (Supplier)
// Terceros que abastecen insumos
// ----------------------------------------------------
model Supplier {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  phone     String?
  email     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("suppliers")
}
```

## Service

```ts
// backend/src/services/supplier.service.ts
/**
 * ====================================================
 * SERVICIO DE PROVEEDORES (MODEL/SERVICE LAYER)
 * ====================================================
 * Gestiona el catálogo de proveedores que abastecen insumos.
 */

import prisma from '../prisma/client';

/**
 * Normaliza un texto opcional: undefined = no tocar, null o vacío = limpiar.
 */
const toNullable = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class SupplierService {
  /**
   * Lista los proveedores ordenados por nombre.
   * @param searchTerm Texto opcional para buscar por nombre o email
   */
  async getAllSuppliers(searchTerm?: string) {
    const term = searchTerm?.trim();

    return prisma.supplier.findMany({
      where: term
        ? { OR: [{ name: { contains: term } }, { email: { contains: term } }] }
        : undefined,
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Obtiene un proveedor por su ID (null si no existe).
   * @param id ID del proveedor
   */
  async getSupplierById(id: number) {
    return prisma.supplier.findUnique({ where: { id } });
  }

  /**
   * Registra un proveedor nuevo.
   * @param data Nombre (obligatorio), teléfono y email opcionales
   */
  async createSupplier(data: { name: string; phone?: string | null; email?: string | null }) {
    return prisma.supplier.create({
      data: {
        name: data.name.trim(),
        phone: toNullable(data.phone) ?? null,
        email: toNullable(data.email) ?? null
      }
    });
  }

  /**
   * Actualiza campos de un proveedor. Lanza P2025 si no existe.
   * @param id ID del proveedor
   * @param data Solo los campos a cambiar (undefined = sin cambio, null = limpiar)
   */
  async updateSupplier(
    id: number,
    data: { name?: string; phone?: string | null; email?: string | null; active?: boolean }
  ) {
    return prisma.supplier.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        phone: toNullable(data.phone),
        email: toNullable(data.email),
        active: data.active
      }
    });
  }

  /**
   * Elimina un proveedor. Lanza P2025 si no existe.
   * Si el proveedor ya tiene documentos asociados, prefiere desactivarlo (active = false).
   * @param id ID del proveedor
   */
  async deleteSupplier(id: number) {
    return prisma.supplier.delete({ where: { id } });
  }
}

// Exportar una única instancia reutilizable del servicio
export const supplierService = new SupplierService();
```

## Controller

```ts
// backend/src/controllers/supplier.controller.ts
/**
 * ====================================================
 * CONTROLADOR DE PROVEEDORES (CONTROLLER LAYER)
 * ====================================================
 * Procesa las peticiones HTTP de proveedores, valida la entrada básica
 * y traduce los errores del service a respuestas JSON.
 */

import { Request, Response } from 'express';
import { supplierService } from '../services/supplier.service';

export class SupplierController {
  /**
   * GET /api/suppliers?search=
   * Lista los proveedores (búsqueda opcional por nombre o email).
   */
  async getSuppliers(req: Request, res: Response) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const suppliers = await supplierService.getAllSuppliers(search);
      return res.json(suppliers);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener los proveedores', details: error.message });
    }
  }

  /**
   * GET /api/suppliers/:id
   * Retorna el detalle de un proveedor.
   */
  async getSupplierById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID de proveedor inválido' });
      }

      const supplier = await supplierService.getSupplierById(id);
      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      return res.json(supplier);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al obtener el proveedor', details: error.message });
    }
  }

  /**
   * POST /api/suppliers
   * Valida la entrada y registra un proveedor.
   */
  async createSupplier(req: Request, res: Response) {
    try {
      const { name, phone, email } = req.body ?? {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
      }

      const supplier = await supplierService.createSupplier({ name, phone, email });
      return res.status(201).json(supplier);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
      }
      return res.status(500).json({ error: 'Error al crear el proveedor', details: error.message });
    }
  }

  /**
   * PUT /api/suppliers/:id
   * Actualiza los campos enviados de un proveedor.
   */
  async updateSupplier(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID de proveedor inválido' });
      }

      const { name, phone, email, active } = req.body ?? {};

      if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({ error: 'El nombre del proveedor no puede estar vacío' });
      }
      if (active !== undefined && typeof active !== 'boolean') {
        return res.status(400).json({ error: 'El campo "active" debe ser booleano' });
      }

      const supplier = await supplierService.updateSupplier(id, { name, phone, email, active });
      return res.json(supplier);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
      }
      return res.status(500).json({ error: 'Error al actualizar el proveedor', details: error.message });
    }
  }

  /**
   * DELETE /api/suppliers/:id
   * Elimina un proveedor.
   */
  async deleteSupplier(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'ID de proveedor inválido' });
      }

      await supplierService.deleteSupplier(id);
      return res.json({ message: 'Proveedor eliminado correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      if (error.code === 'P2003') {
        // FK restrict: otros registros (p. ej. compras) apuntan a este proveedor
        return res.status(400).json({ error: 'No se puede eliminar el proveedor porque tiene registros asociados. Desactívalo en su lugar.' });
      }
      return res.status(500).json({ error: 'Error al eliminar el proveedor', details: error.message });
    }
  }
}

export const supplierController = new SupplierController();
```

## Routes

```ts
// backend/src/routes/supplier.routes.ts
/**
 * ====================================================
 * RUTAS DE PROVEEDORES (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP hacia las acciones de SupplierController.
 */

import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';

const router = Router();

// Endpoint GET: Lista los proveedores (búsqueda opcional con ?search=)
router.get('/', (req, res) => supplierController.getSuppliers(req, res));

// Endpoint GET: Obtiene un proveedor por su ID
router.get('/:id', (req, res) => supplierController.getSupplierById(req, res));

// Endpoint POST: Registra un proveedor nuevo
router.post('/', (req, res) => supplierController.createSupplier(req, res));

// Endpoint PUT: Actualiza un proveedor existente
router.put('/:id', (req, res) => supplierController.updateSupplier(req, res));

// Endpoint DELETE: Elimina un proveedor
router.delete('/:id', (req, res) => supplierController.deleteSupplier(req, res));

export default router;
```

Si agregas rutas estáticas (`/export/...`, `/template/...`), colócalas **antes** de `router.get('/:id', ...)`.

## Registro en el router maestro

```ts
// backend/src/routes/index.ts (fragmentos a agregar)
import supplierRoutes from './supplier.routes';

// Montar submódulo de Proveedores en /api/suppliers
router.use('/suppliers', supplierRoutes);
```

## Variante: paginación en servidor

```ts
// En el service
async getSuppliersPage(limit = 20, page = 1, searchTerm?: string) {
  const safePage = Math.max(1, page);
  const where = searchTerm?.trim()
    ? { name: { contains: searchTerm.trim() } }
    : undefined;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({ where, skip: (safePage - 1) * limit, take: limit, orderBy: { name: 'asc' } }),
    prisma.supplier.count({ where })
  ]);

  return { total, page: safePage, limit, totalPages: Math.ceil(total / limit), suppliers };
}

// En el controller: lee y acota (no asignes a req.query)
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
const page = Math.max(1, Number(req.query.page) || 1);
```

## Variante: filtros tipados

```ts
import { Prisma } from '@prisma/client';

const where: Prisma.SupplierWhereInput = {};
if (filters?.active !== undefined) where.active = filters.active;
if (filters?.search) where.name = { contains: filters.search };
```

En el controller convierte los query params antes de pasarlos: `available: req.query.available !== undefined ? req.query.available === 'true' : undefined`.

## Pruebas rápidas

Con el backend corriendo (`npm run dev`), desde la raíz del repo (funciona igual en PowerShell, cmd y bash):

```bash
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/suppliers name=Acme phone=555-1234
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET "/api/suppliers?search=ac"
node .claude/skills/fullstack-verify-changes/scripts/api.mjs PUT /api/suppliers/1 phone=null
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/suppliers           # sin body -> 400
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers/abc        # id inválido -> 400
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers/9999       # inexistente -> 404
node .claude/skills/fullstack-verify-changes/scripts/api.mjs DELETE /api/suppliers/1
```
