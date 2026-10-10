---
name: backend-excel-import-export
description: Descarga de plantillas y reportes Excel y carga masiva .xlsx en el backend (exceljs + multer) - rutas /template, /export, /import, controller con headers de descarga, service con iteración async correcta y resumen created/updated/skipped/errors. Úsala al agregar importar/exportar Excel, plantilla, reporte o carga masiva a cualquier módulo. Incluye el bug conocido de eachRow(async).
---

# Backend: plantilla, reporte e importación de Excel

Hay una implementación de referencia en `ingredient.routes.ts` / `ingredient.controller.ts` / `ingredient.service.ts`. **Copia su estructura pero no su bucle de importación**: usa `worksheet.eachRow(async ...)`, que no espera a las promesas, así que la respuesta se envía con `created: 0, updated: 0` y los errores vacíos mientras las filas se procesan después (reproducido). El patrón correcto está abajo y en `references/templates.md`.

## Contrato (frontend y backend deben coincidir)

| Endpoint | Respuesta |
|---|---|
| `GET /api/<mod>/template/<mod>` | `.xlsx` con encabezados y 1-2 filas de ejemplo (`plantilla_carga_<modulo>.xlsx`) |
| `GET /api/<mod>/export/<mod>` | `.xlsx` con los datos actuales (`reporte_<modulo>.xlsx`) |
| `POST /api/<mod>/import/<mod>` (multipart, campo `file`) | `200 { message, summary: { created, updated, skipped, errors: string[] } }` |

Las tres rutas estáticas se registran **antes** de `/:id`. Mensajes y nombres de archivo en español, snake_case.

## Pasos

1. **Routes**: `multer` con `memoryStorage()` y `limits.fileSize` (10 MB); envuelve `upload.single('file')` para devolver 400 amigable si el archivo es demasiado grande (de lo contrario multer lanza al manejador global y responde 500).
2. **Controller**: valida `req.file`, extensión `.xlsx`, llama al service y responde. Para descargas, **construye el workbook primero**, luego fija `Content-Type` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) y `Content-Disposition: attachment; filename="..."`, y finalmente `await workbook.xlsx.write(res); res.end()`. (Si algo falla después de enviar headers ya no se puede responder JSON.)
3. **Service**: tres métodos (`generate...Template`, `export...ToExcel`, `import...FromExcel`) que usan `ExcelJS.Workbook`. Encabezado con fondo de marca (`FF584235`) y texto blanco (`FFFFFFFF`); usa colores **ARGB de 8 dígitos** (con 6 dígitos Excel puede interpretar mal el color).
4. **Importación** (lo delicado):
   - `eachRow` es **síncrono**: úsalo solo para *recolectar* filas en un arreglo; luego `for (const r of rows) { ... await ... }`.
   - Lee celdas con `cell.text` (maneja fórmulas, texto enriquecido y números) y recorta; convierte números con `Number()` y valida `Number.isFinite`.
   - Valida los encabezados de la fila 1 para rechazar archivos que no son la plantilla (`INVALID_TEMPLATE`), y limita el número de filas (p. ej. 5000, `TOO_MANY_ROWS`).
   - Cada fila en su propio `try/catch`: un error no aborta el lote; agrega `Fila N (nombre): motivo corto` a `errors` (mapea `P2002` a "duplicado"; no vuelques mensajes largos de Prisma).
   - Clave de upsert = campo único del dominio (p. ej. `name`). Filas sin los campos obligatorios -> `skipped`.
   - Si la entidad tiene stock, cada fila que cree/cambie stock debe ir en su `prisma.$transaction` junto con su movimiento de Kardex (skill `backend-transactions-kardex`). La implementación de insumos hoy actualiza `currentStock` de existentes **sin** movimiento: no lo repliques.
   - Si necesitas "todo o nada", envuelve el lote en una sola transacción con `{ timeout: 30000 }` y reporta el primer error; decídelo con el usuario.
5. **Frontend**: skill `frontend-excel-import-export` (descarga con blob, modal de arrastrar y soltar, resumen).

## Verificación

- [ ] Descarga la plantilla, ábrela en Excel/LibreOffice (colores y anchos correctos).
- [ ] Importa una plantilla con filas válidas, una repetida (update), una vacía (skipped) y una inválida (errors): el `summary` de la **respuesta** debe reflejar el resultado real (los números ya deben estar cuando llega la respuesta).
- [ ] Importa un `.csv`/`.xls`, un archivo > límite, y un `.xlsx` ajeno: respuestas 400 con mensaje claro.
- [ ] `GET .../export/...` refleja lo importado.
- [ ] `npx tsc --noEmit` limpio; plantilla/export/import registrados antes de `/:id`; `api-endpoints.md` actualizado.
