# Plantillas de módulo backend (ejemplo: Supplier / proveedores)

Reemplaza `Supplier` -> tu entidad, `supplier` -> instancia/archivo, `suppliers` -> plural/URL/tabla, y ajusta los campos. La primera línea de cada bloque indica la ruta del archivo. Los helpers de validación y errores (`errorDetails`, `parseId`, `parseRequiredText`, `parseOptionalText`, `validateIdParam`, `parsePagination`) viven en `backend/src/utils/http.utils.ts`; los guardias de rol, en `backend/src/middleware/auth.middleware.ts`.

## Contenido
- Modelo Prisma
- Service
- Controller
- Routes (con rol)
- Registro en el router maestro y matriz de roles
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
   * Registra un proveedor nuevo. El controller ya validó y recortó los textos
   * (`phone`/`email`: null = sin valor).
   * @param data Nombre (obligatorio), teléfono y email opcionales
   */
  async createSupplier(data: { name: string; phone?: string | null; email?: string | null }) {
    return prisma.supplier.create({
      data: { name: data.name, phone: data.phone ?? null, email: data.email ?? null }
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
    return prisma.supplier.update({ where: { id }, data });
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

El id de la URL ya llega validado (400 `ID inválido` lo responde `router.param`, ver Routes), así que el controller solo hace `Number(req.params.id)`.

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
import { errorDetails, parseOptionalText, parseRequiredText } from '../utils/http.utils';

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
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener los proveedores', details: errorDetails(error) });
    }
  }

  /**
   * GET /api/suppliers/:id
   * Retorna el detalle de un proveedor.
   */
  async getSupplierById(req: Request, res: Response) {
    try {
      const supplier = await supplierService.getSupplierById(Number(req.params.id));
      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      return res.json(supplier);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener el proveedor', details: errorDetails(error) });
    }
  }

  /**
   * POST /api/suppliers
   * Valida la entrada y registra un proveedor.
   */
  async createSupplier(req: Request, res: Response) {
    try {
      const { name, phone, email } = req.body ?? {};

      const trimmedName = parseRequiredText(name);
      if (trimmedName === null) {
        return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
      }
      const parsedPhone = parseOptionalText(phone);
      const parsedEmail = parseOptionalText(email);
      if (!parsedPhone.valid || !parsedEmail.valid) {
        return res.status(400).json({ error: 'El teléfono y el email deben ser texto' });
      }

      const supplier = await supplierService.createSupplier({
        name: trimmedName,
        phone: parsedPhone.value,
        email: parsedEmail.value
      });
      return res.status(201).json(supplier);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
      }
      return res.status(500).json({ error: 'Error al crear el proveedor', details: errorDetails(error) });
    }
  }

  /**
   * PUT /api/suppliers/:id
   * Actualiza los campos enviados de un proveedor (`phone: null` o '' lo limpia).
   */
  async updateSupplier(req: Request, res: Response) {
    try {
      const { name, phone, email, active } = req.body ?? {};
      const data: { name?: string; phone?: string | null; email?: string | null; active?: boolean } = {};

      if (name !== undefined) {
        const trimmedName = parseRequiredText(name);
        if (trimmedName === null) {
          return res.status(400).json({ error: 'El nombre del proveedor no puede estar vacío' });
        }
        data.name = trimmedName;
      }
      const parsedPhone = parseOptionalText(phone);
      const parsedEmail = parseOptionalText(email);
      if (!parsedPhone.valid || !parsedEmail.valid) {
        return res.status(400).json({ error: 'El teléfono y el email deben ser texto' });
      }
      if (parsedPhone.value !== undefined) data.phone = parsedPhone.value;
      if (parsedEmail.value !== undefined) data.email = parsedEmail.value;
      if (active !== undefined) {
        if (typeof active !== 'boolean') {
          return res.status(400).json({ error: 'El campo "active" debe ser booleano' });
        }
        data.active = active;
      }

      const supplier = await supplierService.updateSupplier(Number(req.params.id), data);
      return res.json(supplier);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
      }
      return res.status(500).json({ error: 'Error al actualizar el proveedor', details: errorDetails(error) });
    }
  }

  /**
   * DELETE /api/suppliers/:id
   * Elimina un proveedor.
   */
  async deleteSupplier(req: Request, res: Response) {
    try {
      await supplierService.deleteSupplier(Number(req.params.id));
      return res.json({ message: 'Proveedor eliminado correctamente' });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
      if (error.code === 'P2003') {
        // FK restrict: otros registros (p. ej. compras) apuntan a este proveedor
        return res.status(400).json({ error: 'No se puede eliminar el proveedor porque tiene registros asociados. Desactívalo en su lugar.' });
      }
      return res.status(500).json({ error: 'Error al eliminar el proveedor', details: errorDetails(error) });
    }
  }
}

export const supplierController = new SupplierController();
```

`details` es siempre `errorDetails(error)` (texto; los errores de Prisma se sustituyen por uno genérico): **nunca** `details: error`.

## Routes (con rol)

```ts
// backend/src/routes/supplier.routes.ts
/**
 * ====================================================
 * RUTAS DE PROVEEDORES (ROUTER LAYER)
 * ====================================================
 * Mapeo de verbos HTTP hacia las acciones de SupplierController.
 * Roles: todos leen; solo ADMIN escribe.
 */

import { Router } from 'express';
import { supplierController } from '../controllers/supplier.controller';
import { requireRole } from '../middleware/auth.middleware';
import { validateIdParam } from '../utils/http.utils';

const router = Router();

// Cualquier :id que no sea un entero positivo responde 400 { error: 'ID inválido' }
router.param('id', validateIdParam);

// Endpoint GET: Lista los proveedores (búsqueda opcional con ?search=)
router.get('/', (req, res) => supplierController.getSuppliers(req, res));

// Endpoint GET: Obtiene un proveedor por su ID
router.get('/:id', (req, res) => supplierController.getSupplierById(req, res));

// Endpoint POST: Registra un proveedor nuevo (solo ADMIN)
router.post('/', requireRole('ADMIN'), (req, res) => supplierController.createSupplier(req, res));

// Endpoint PUT: Actualiza un proveedor existente (solo ADMIN)
router.put('/:id', requireRole('ADMIN'), (req, res) => supplierController.updateSupplier(req, res));

// Endpoint DELETE: Elimina un proveedor (solo ADMIN)
router.delete('/:id', requireRole('ADMIN'), (req, res) => supplierController.deleteSupplier(req, res));

export default router;
```

Si agregas rutas estáticas (`/export/...`, `/template/...`), colócalas **antes** de `router.get('/:id', ...)`. Si el trabajador solo debe poder tocar ciertos campos de una ruta (como marcar un producto agotado), usa `requireAdminOrFields('available')` en lugar de `requireRole('ADMIN')`. Si **todo** el módulo es solo ADMIN, pon `requireRole('ADMIN')` en el montaje de `routes/index.ts` (como `/users` y `/sales`).

## Registro en el router maestro y matriz de roles

```ts
// backend/src/routes/index.ts (fragmentos a agregar, DESPUÉS de `router.use(authenticate)`)
import supplierRoutes from './supplier.routes';

// Montar submódulo de Proveedores en /api/suppliers
router.use('/suppliers', supplierRoutes);
```

Todo lo que se monte debajo de `router.use(authenticate)` exige token automáticamente. Después declara **cada ruta** en `backend/tests/helpers/roleMatrix.ts` (la prueba-guardia `auth-route-guard.test.ts` falla si falta o sobra alguna):

```ts
// backend/tests/helpers/roleMatrix.ts (agregar a ROLE_MATRIX)
{ route: 'GET /api/suppliers', worker: 'allow' },
{ route: 'GET /api/suppliers/:id', worker: 'allow' },
{ route: 'POST /api/suppliers', worker: 'deny' },
{ route: 'PUT /api/suppliers/:id', worker: 'deny' },
{ route: 'DELETE /api/suppliers/:id', worker: 'deny' },
```

## Variante: paginación en servidor

Contrato del proyecto: si no llega `page` ni `limit` se devuelve la lista completa; con alguno, `{ total, page, limit, totalPages, <items> }`.

```ts
// En el service
async getSuppliersPage(pagination: { page: number; limit: number }, searchTerm?: string) {
  const where = searchTerm?.trim()
    ? { name: { contains: searchTerm.trim() } }
    : undefined;

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit
    })
  ]);

  return { total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit), suppliers };
}

// En el controller (parsePagination: undefined = sin paginar, null = inválido -> 400, recorta limit al máximo)
import { parsePagination } from '../utils/http.utils';

const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
if (pagination === null) {
  return res.status(400).json({ error: 'page y limit deben ser enteros mayores a 0' });
}
if (pagination) {
  return res.json(await supplierService.getSuppliersPage(pagination, search));
}
```

## Variante: filtros tipados

```ts
import { Prisma } from '@prisma/client';

const where: Prisma.SupplierWhereInput = {};
if (filters?.active !== undefined) where.active = filters.active;
if (filters?.search) where.name = { contains: filters.search };
```

En el controller convierte los query params antes de pasarlos y responde 400 si un valor no es válido: `categoryId` con `parseId(...)` (devuelve `null` si no es un entero positivo) y `available: req.query.available !== undefined ? req.query.available === 'true' : undefined`.

## Pruebas rápidas

Con el backend corriendo (`npm run dev`, o aislado como indica `fullstack-verify-changes`), desde la raíz del repo (funciona igual en PowerShell, cmd y bash). `api.mjs` inicia sesión por sí solo (`Admin` / `123456` por defecto) y adjunta el token; con `--as <usuario>` entras con otro rol.

```bash
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/suppliers name=Acme phone=555-1234
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET "/api/suppliers?search=ac"
node .claude/skills/fullstack-verify-changes/scripts/api.mjs PUT /api/suppliers/1 phone=null
node .claude/skills/fullstack-verify-changes/scripts/api.mjs POST /api/suppliers           # sin body -> 400
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers/abc        # id inválido -> 400
node .claude/skills/fullstack-verify-changes/scripts/api.mjs GET /api/suppliers/9999       # inexistente -> 404
node .claude/skills/fullstack-verify-changes/scripts/api.mjs --no-auth GET /api/suppliers  # sin token -> 401
node .claude/skills/fullstack-verify-changes/scripts/api.mjs DELETE /api/suppliers/1
```
