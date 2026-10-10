---
name: frontend-alerts-dialogs
description: Confirmaciones, alertas de error y toasts de éxito con SweetAlert2 mediante src/app/common/alertUtils.js (confirmDialog, showErrorAlert, showSuccessToast) con el estilo de marca. Úsala SIEMPRE antes de eliminar, desactivar, cerrar caja o cualquier acción irreversible, y al mostrar errores o éxitos de una operación; nunca uses window.confirm, alert ni prompt.
---

# Frontend: confirmaciones, alertas y toasts (SweetAlert2)

Todo el feedback transitorio de la app sale de **tres funciones** en `frontend/src/app/common/alertUtils.js`. Usarlas (en lugar de `window.confirm/alert/prompt` o de estados de toast propios) da el mismo aspecto de marca en toda la app y evita que el diálogo nativo bloquee el hilo de la página y deje los inputs sin foco.

| Función | Cuándo | Devuelve |
|---|---|---|
| `confirmDialog({ title, text, confirmButtonText, cancelButtonText, icon })` | antes de una acción destructiva o irreversible | `Promise<SweetAlertResult>` -> usa `result.isConfirmed` |
| `showErrorAlert(title, text)` | falló una operación del servidor que el usuario no puede corregir en el mismo formulario | `Promise` (puedes `await` para pausar el flujo) |
| `showSuccessToast(title)` | operación terminada con éxito (toast abajo a la derecha, 3 s) | `Promise` |

Defaults de `confirmDialog`: título "¿Estás seguro?", botón "Sí, eliminar", `icon: 'warning'`, `focusCancel: true` (el foco inicial está en Cancelar, para que Enter no borre por accidente) y `reverseButtons`. Para acciones no destructivas sobrescribe `confirmButtonText` e `icon`.

## Patrón: eliminar / desactivar (en la **página**, no en el componente de presentación)

```jsx
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';

const handleDelete = async (item) => {
  const result = await confirmDialog({
    title: `¿Eliminar "${item.name}"?`,
    text: 'Esta acción no se puede deshacer.',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  });
  if (!result.isConfirmed) return;

  try {
    await deleteItem(item.id);
    showSuccessToast('Elemento eliminado correctamente.');
    loadData();
  } catch (err) {
    showErrorAlert('Error al eliminar', err.message || 'No se pudo completar la operación.');
  }
};
```

## Reglas

1. **El texto debe ser verdad.** Describe lo que realmente hace el backend (borrar un producto elimina también sus líneas de comanda y venta; eliminar una categoría con productos falla). No prometas comportamientos que el servidor no implementa.
2. **Título con el nombre del elemento** (`¿Eliminar "X"?`), botón de confirmación con el verbo (`Sí, desactivar`, `Sí, cerrar caja`), cancelar con "Cancelar" o una alternativa clara ("Revisar conteo").
3. **Dónde mostrar cada error**: validación de formulario -> banner dentro del modal; fallo del servidor tras confirmar -> `showErrorAlert`; en un modal cuyo `onSubmit` lanza, el modal muestra el error y, si la página ya lo mostró con `showErrorAlert`, vuelve a lanzar (`throw err`) para que el modal permanezca abierto.
4. **Doble clic mientras hay un diálogo**: si un envío espera un `confirmDialog`, activa la bandera `isSubmittingRef.current = true` antes del `await` y restáurala si el usuario cancela (patrón de `CloseCajaModal`).
5. **Limpieza en `finally`**: cualquier estado de carga (`setSaving(false)`, `deletingId`) se restablece en `finally` para no dejar botones deshabilitados.
6. **Mensajes de éxito** en pasado, cortos y en español: "Producto eliminado del menú.", "Trabajador activado con éxito."
7. **Sin toasts propios**: `ProductsPage` e `InventoryPage` aún tienen un `showToast` local (legado, y su animación `animate-slide-up` ni existe). En código nuevo usa `showSuccessToast`/`showErrorAlert`.
8. **Nuevos tipos de alerta** (info, aviso): agrégalos en `alertUtils.js` reutilizando los colores (`#E63946` confirmar, `#94a3b8` cancelar) y las clases `rounded-3xl`/`rounded-2xl` de los existentes; no llames a `Swal.fire` suelto en componentes.

## Terminado cuando

- [ ] No queda ningún `window.confirm|alert|prompt` (el script `preflight.mjs` lo busca).
- [ ] Cada acción destructiva pasa por `confirmDialog` y el texto es veraz.
- [ ] Éxito y error usan `showSuccessToast` / `showErrorAlert` o el banner del modal, según la regla 3.
