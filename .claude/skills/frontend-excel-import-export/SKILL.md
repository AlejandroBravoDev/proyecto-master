---
name: frontend-excel-import-export
description: UI para descargar plantillas y reportes Excel (blob) y para carga masiva con modal de arrastrar y soltar y resumen created/updated/skipped/errors en el frontend React. Úsala siempre que se agregue importar, exportar, descargar plantilla, subir archivo o carga masiva a un módulo; el lado servidor está en la skill backend-excel-import-export.
---

# Frontend: descargar plantilla / exportar / importar Excel

Implementación de referencia: `frontend/src/app/inventory/` (`inventoryService.js`, `InventoryHeaderCard.jsx`, `BulkImportModal.jsx`, `InventoryPage.jsx`). El contrato con el servidor (rutas y resumen) está en `backend-excel-import-export`; no lo cambies solo en un lado.

## Piezas

1. **Endpoints** (`services/endpoints.js`): `TEMPLATE` -> `/api/<mod>/template/<mod>`, `EXPORT` -> `/api/<mod>/export/<mod>`, `IMPORT` -> `/api/<mod>/import/<mod>` (getters con `getApiBaseUrl()`, ver `frontend-api-service`).
2. **Service**: dos funciones de descarga y una de subida.
3. **Header card**: botones "Descargar Plantilla" y "Exportar Excel" (todos los roles, con estado `downloading...`) e "Importar Masivo" (solo `isAdmin`).
4. **`<Feature>BulkImportModal.jsx`**: copia de `BulkImportModal.jsx` cambiando textos, la función de servicio importada y las extensiones.
5. **Página**: estados `downloadingTemplate`, `exportingExcel`, `importModalOpen`; handlers con `try/catch/finally` y `onImportSuccess={() => { showSuccessToast(...); loadData(); }}`.

## Service

Va en el `<feature>Service.js` de la feature, sobre la capa HTTP compartida (`requestBlob` y `requestJson` de `config/apiFetch.js`; ver `frontend-api-service`): ella manda el token, traduce el error de red a español y cierra la sesión ante un 401. **Las descargas nunca van por un enlace directo** (`<a href>`, `window.open`): el navegador no puede mandar la cabecera `Authorization` y la API respondería 401; hay que pedir el `Blob` con `requestBlob` y crear el enlace de descarga desde él.

```js
import { requestBlob, requestJson } from '../../../config/apiFetch';

/**
 * Downloads a binary file from the backend and triggers the browser's save dialog.
 * @param {string} url
 * @param {string} filename   name suggested to the user
 * @param {string} failureMessage generic Spanish error text (without the "Error (N):" prefix)
 */
async function downloadFile(url, filename, failureMessage) {
  const blob = await requestBlob(url, {}, failureMessage);
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export const downloadSuppliersTemplate = () =>
  downloadFile(SUPPLIER_ENDPOINTS.TEMPLATE, 'plantilla_carga_proveedores.xlsx', 'No se pudo descargar la plantilla.');
export const exportSuppliersReport = () =>
  downloadFile(SUPPLIER_ENDPOINTS.EXPORT, 'reporte_proveedores.xlsx', 'No se pudo exportar el reporte.');

/**
 * Uploads an .xlsx file for bulk import.
 * @param {File} file
 * @returns {Promise<{ message: string, summary: { created: number, updated: number, skipped: number, errors: string[] } }>}
 */
export function importSuppliersExcel(file) {
  const formData = new FormData();
  formData.append('file', file); // field name must be "file" (multer.single('file'))

  // With FormData, requestJson does NOT set Content-Type: the browser adds multipart/form-data with its boundary
  return requestJson(SUPPLIER_ENDPOINTS.IMPORT, { method: 'POST', body: formData }, 'Falló la importación masiva.');
}
```

`inventoryService.js` ya tiene su `downloadFile` (un solo bloque de descarga para plantilla y reporte). Si una segunda feature necesita descargas, mueve `downloadFile` a `frontend/src/app/common/fileUtils.js` y úsalo desde ambas (no copies una segunda vez). En el servidor, importar es solo ADMIN (403 al trabajador) y descargar plantilla/reporte es para todos.

## Modal de importación (`BulkImportModal.jsx`)

Comportamiento a conservar al copiarlo:

1. **Zona de arrastrar y soltar**: `onDragOver` (preventDefault + `isDragging`), `onDragLeave`, `onDrop` (primer archivo de `e.dataTransfer.files`), clic que dispara un `<input type="file" accept=".xlsx" className="hidden">` por `ref`.
2. **Validación en el cliente**: extensión permitida (**`.xlsx` únicamente**: el backend no lee `.xls` ni `.csv`) y tamaño máximo (`file.size <= 10 * 1024 * 1024`, el mismo límite que multer en el backend) con un mensaje claro antes de subir. `BulkImportModal.jsx` ya lo hace; si algún día el backend soporta CSV o cambia el límite, cambia ambos lados juntos.
3. **Vista previa del archivo**: nombre, tamaño legible (`formatFileSize`) y botón para quitarlo antes de subir.
4. **Subida protegida**: `uploading` + `isUploadingRef` contra doble clic; botón con spinner y texto "Subiendo y procesando...".
5. **Resumen**: al llegar `{ message, summary }`, tarjetas con **Creados / Actualizados / Omitidos** (`summary.created ?? 0`, etc.) y, si `summary.errors.length > 0`, una lista (`max-h-32 overflow-y-auto`) con las filas con error. Botones "Importar otro archivo" y "Listo / Cerrar".
6. **Aviso de la plantilla**: texto que invita a descargar primero la plantilla oficial.
7. Llama a `onImportSuccess()` tras importar para que la página recargue y muestre el toast.

## Lado de la página (resumen)

```jsx
const handleDownloadTemplate = async () => {
  setDownloadingTemplate(true);
  try {
    await downloadSuppliersTemplate();
    showSuccessToast('Plantilla descargada correctamente.');
  } catch (err) {
    showErrorAlert('Error al descargar', err.message || 'No se pudo descargar la plantilla.');
  } finally {
    setDownloadingTemplate(false);
  }
};
```

## Terminado cuando

- [ ] Plantilla y reporte se descargan con el nombre esperado y abren en Excel.
- [ ] Importar: archivo válido -> resumen coherente con lo que quedó en BD; archivo inválido / muy grande -> mensaje claro sin romper el modal.
- [ ] "Importar Masivo" solo visible para admin; descargas visibles para todos.
- [ ] Botones muestran estado de carga y no permiten doble clic.
- [ ] `npm run build` sin errores.
