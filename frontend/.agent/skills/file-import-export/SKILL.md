---
name: file-import-export
description: Standard clean code guidelines and reusable patterns for Excel/CSV file downloads (Blobs/streams) and Drag & Drop multipart/form-data file uploads with progress and summary feedback in the frontend application. Use whenever implementing bulk imports, templates, or report exports.
---

# File Import & Export Skill

This skill defines the standard pattern for handling file downloads (templates, reports) and multipart drag & drop file uploads in the React Clean Architecture.

---

## 📥 1. File Downloads Pattern (Templates & Reports)

When downloading generated binary files (e.g. `.xlsx`, `.csv`, `.pdf`) from backend endpoints:

### Service Layer Implementation
```javascript
export async function downloadFileBlob(url, defaultFilename) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`Error (${response.status}): No se pudo descargar el archivo.`);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = defaultFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
```

---

## 📤 2. Drag & Drop File Upload Pattern (Bulk Import)

When uploading files via `POST` with `multipart/form-data`:

### Service Layer Implementation
```javascript
export async function uploadExcelFile(url, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Error (${response.status}): Falló la carga del archivo.`);
  }

  return response.json();
}
```

### UI Component Guidelines (`BulkImportModal.jsx`)
1. **Drag & Drop Area**:
   - Support `onDragOver`, `onDragLeave`, `onDrop` events.
   - Accept file selection via hidden `<input type="file" accept=".xlsx, .xls, .csv" />`.
2. **File Preview**:
   - Display filename, formatted file size, and a remove button before uploading.
3. **Summary Feedback Display**:
   - When the backend responds with `{ message, summary: { created, updated, skipped, errors } }`, render clean badges for each metric.
   - List specific validation errors if present.
