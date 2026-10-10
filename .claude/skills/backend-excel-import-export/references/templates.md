# Plantillas Excel para un módulo (ejemplo: Supplier)

Se agregan al módulo existente (`supplier.routes.ts`, `supplier.controller.ts`, `supplier.service.ts` de `backend-new-module/references/templates.md`). Ajusta nombres, columnas y la clave de upsert.

## Contenido
- Routes
- Controller
- Service (plantilla, reporte, importación)
- Notas

## Routes

```ts
// backend/src/routes/supplier.routes.ts (fragmento)
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { supplierController } from '../controllers/supplier.controller';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

// Convierte los errores de multer en respuestas 400 con mensaje claro
const uploadSingleFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño máximo de 10 MB'
      : 'No se pudo leer el archivo adjunto';
    return res.status(400).json({ error: message });
  });
};

const router = Router();

router.get('/', (req, res) => supplierController.getSuppliers(req, res));

// Rutas estáticas ANTES de '/:id'
router.get('/template/suppliers', (req, res) => supplierController.downloadTemplate(req, res));
router.get('/export/suppliers', (req, res) => supplierController.exportExcel(req, res));
router.post('/import/suppliers', uploadSingleFile, (req, res) => supplierController.importExcel(req, res));

router.get('/:id', (req, res) => supplierController.getSupplierById(req, res));
```

## Controller

```ts
// backend/src/controllers/supplier.controller.ts (métodos a agregar a la clase)
  /**
   * GET /api/suppliers/template/suppliers
   * Descarga la plantilla de Excel para la carga masiva.
   */
  async downloadTemplate(_req: Request, res: Response) {
    try {
      const workbook = await supplierService.generateSuppliersTemplate();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_carga_proveedores.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al generar la plantilla de Excel', details: error.message });
    }
  }

  /**
   * GET /api/suppliers/export/suppliers
   * Descarga el reporte de proveedores en Excel.
   */
  async exportExcel(_req: Request, res: Response) {
    try {
      const workbook = await supplierService.exportSuppliersToExcel();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte_proveedores.xlsx"');

      await workbook.xlsx.write(res);
      return res.end();
    } catch (error: any) {
      return res.status(500).json({ error: 'Error al exportar el reporte a Excel', details: error.message });
    }
  }

  /**
   * POST /api/suppliers/import/suppliers
   * Carga masiva desde un archivo .xlsx (multipart/form-data, campo "file").
   */
  async importExcel(req: Request, res: Response) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Se requiere adjuntar un archivo de Excel (campo file)' });
      }
      if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
        return res.status(400).json({ error: 'Solo se admiten archivos Excel con extensión .xlsx' });
      }

      const summary = await supplierService.importSuppliersFromExcel(req.file.buffer);
      return res.status(200).json({ message: 'Proceso de carga masiva finalizado', summary });
    } catch (error: any) {
      if (error.message === 'NO_WORKSHEET_FOUND') {
        return res.status(400).json({ error: 'El archivo Excel subido no contiene hojas válidas' });
      }
      if (error.message === 'INVALID_TEMPLATE') {
        return res.status(400).json({ error: 'El archivo no coincide con la plantilla. Descarga la plantilla oficial y vuelve a intentarlo' });
      }
      if (error.message === 'TOO_MANY_ROWS') {
        return res.status(400).json({ error: 'El archivo supera el máximo de 5000 filas por carga' });
      }
      if (error.message?.includes('end of central directory') || error.message?.includes("zip")) {
        return res.status(400).json({ error: 'El archivo no es un .xlsx válido' });
      }
      return res.status(500).json({ error: 'Error al procesar la carga masiva', details: error.message });
    }
  }
```

(Requiere `import` de los tipos ya presentes en el controller: `Request`, `Response`.)

## Service

```ts
// backend/src/services/supplier.service.ts (imports y métodos a agregar)
import ExcelJS from 'exceljs';

const MAX_IMPORT_ROWS = 5000;
const HEADER_FILL = 'FF584235'; // marrón de marca (ARGB, 8 dígitos)

/** Texto de una celda ya recortado (cell.text resuelve fórmulas y texto enriquecido). */
const cellText = (cell: ExcelJS.Cell): string => String(cell.text ?? '').trim();

/** Normaliza un encabezado: minúsculas, sin "(*)" ni espacios sobrantes. */
const normalizeHeader = (value: string): string => value.replace(/\(\*\)/g, '').trim().toLowerCase();

  /**
   * Genera el libro de Excel con la plantilla de carga masiva.
   */
  async generateSuppliersTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Plantilla Proveedores');
    worksheet.columns = [
      { header: 'Nombre (*)', key: 'name', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 20 },
      { header: 'Email', key: 'email', width: 32 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    worksheet.addRow({ name: 'Distribuidora Ejemplo', phone: '555-1234', email: 'ventas@ejemplo.com' });

    return workbook;
  }

  /**
   * Genera el libro de Excel con el reporte actual de proveedores.
   */
  async exportSuppliersToExcel(): Promise<ExcelJS.Workbook> {
    const suppliers = await this.getAllSuppliers();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reporte Proveedores');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 20 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Estado', key: 'status', width: 14 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (const s of suppliers) {
      worksheet.addRow({
        id: s.id,
        name: s.name,
        phone: s.phone ?? '-',
        email: s.email ?? '-',
        status: s.active ? 'ACTIVO' : 'INACTIVO'
      });
    }

    return workbook;
  }

  /**
   * Importa proveedores desde un .xlsx (upsert por nombre). Devuelve el resumen
   * solo cuando TODAS las filas ya se procesaron.
   * @param buffer Contenido binario del archivo subido
   */
  async importSuppliersFromExcel(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any); // exceljs tipa Buffer con una definición antigua

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('NO_WORKSHEET_FOUND');
    }

    // Rechazar archivos que no son la plantilla
    if (normalizeHeader(cellText(worksheet.getRow(1).getCell(1))) !== 'nombre') {
      throw new Error('INVALID_TEMPLATE');
    }

    // 1) Recolectar filas. eachRow es SÍNCRONO: nunca pongas `async`/`await` en su callback.
    const rows: Array<{ n: number; name: string; phone: string; email: string }> = [];
    worksheet.eachRow((row, n) => {
      if (n === 1) return; // encabezado
      rows.push({
        n,
        name: cellText(row.getCell(1)),
        phone: cellText(row.getCell(2)),
        email: cellText(row.getCell(3))
      });
    });

    if (rows.length > MAX_IMPORT_ROWS) {
      throw new Error('TOO_MANY_ROWS');
    }

    // 2) Procesar en secuencia esperando cada fila
    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const r of rows) {
      if (!r.name) {
        results.skipped++;
        continue;
      }

      try {
        const existing = await prisma.supplier.findUnique({ where: { name: r.name } });

        if (existing) {
          await prisma.supplier.update({
            where: { id: existing.id },
            data: { phone: r.phone || existing.phone, email: r.email || existing.email }
          });
          results.updated++;
        } else {
          await prisma.supplier.create({
            data: { name: r.name, phone: r.phone || null, email: r.email || null }
          });
          results.created++;
        }
      } catch (err: any) {
        const reason = err?.code === 'P2002' ? 'registro duplicado' : 'error al procesar la fila';
        results.errors.push(`Fila ${r.n} (${r.name}): ${reason}`);
      }
    }

    return results;
  }
```

## Notas

- El nombre de hoja/archivos va en español; los encabezados deben coincidir con lo que valida `INVALID_TEMPLATE`.
- Números: lee `cellText(...)` y convierte con `Number(...)`; descarta con `Number.isFinite` (las celdas con coma decimal o texto llegan como string).
- Para entidades con stock agrega el movimiento de Kardex dentro de una transacción por fila (ver `backend-transactions-kardex`).
- Probar el bug original: reemplazar el `for` por `rows.forEach(async ...)` hace que `created` llegue en 0 en la respuesta.
