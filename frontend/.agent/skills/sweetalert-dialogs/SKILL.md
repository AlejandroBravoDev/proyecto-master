---
name: sweetalert-dialogs
description: Standard guidelines and utility patterns for non-blocking confirmation dialogs and alerts using SweetAlert2 styled with project brand colors (#E63946, #584235). Use whenever asking users for confirmation before destructive actions or displaying error alerts in the Electron/React frontend.
---

# SweetAlert2 Confirmation & Alert Dialogs Skill

This skill defines the standard pattern for implementing non-blocking user confirmation dialogs and alerts in Electron/React applications.

---

## 🚫 Why Avoid Native `window.confirm()` / `window.alert()` in Electron?

In Chromium/Electron, calling synchronous browser dialogs (`window.confirm()`, `window.alert()`, `window.prompt()`):
1. **Halts the Chromium renderer event loop**.
2. **Breaks input focus**: Electron webviews often permanently lose keyboard input focus after native dialogs close, making inputs unresponsive until app restart.
3. Cannot be custom styled to match brand aesthetics (`rounded-3xl`, `#E63946`, `#584235`).

---

## 🛠️ Usage Pattern (`src/app/common/alertUtils.js`)

### 1. Confirmation Dialog Before Deletion
```javascript
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';

const handleDeleteItem = async (item) => {
  const result = await confirmDialog({
    title: `¿Eliminar "${item.name}"?`,
    text: 'Esta acción no se puede deshacer.',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });

  if (result.isConfirmed) {
    try {
      await deleteItemService(item.id);
      showSuccessToast('Elemento eliminado correctamente.');
      loadData();
    } catch (err) {
      showErrorAlert('Error al eliminar', err.message || 'No se pudo completar la operación.');
    }
  }
};
```

---

## ✅ Best Practices
- Always use `confirmDialog` from `alertUtils.js` for destructive actions (deleting ingredients, products, categories, orders).
- Use `showErrorAlert` for server/API error popups.
- Keep inputs focusable and reset any form loading states (`setSaving(false)`) inside `finally` blocks.
