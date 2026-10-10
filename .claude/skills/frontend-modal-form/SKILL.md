---
name: frontend-modal-form
description: Patrón de modal de crear/editar/detalle en React - props isOpen/onClose/onSubmit/initialData, reinicio del formulario al abrir, anti doble envío con isSubmittingRef, validación, banner de error y estructura visual de marca. Úsala SIEMPRE que pidan un modal, formulario, popup, diálogo de captura o ventana de edición/detalle en el frontend, aunque no digan "modal".
---

# Frontend: modal de formulario (crear / editar / detalle)

Todos los modales de la app (`UserModal`, `IngredientModal`, `ProductModal`, `OpenCajaModal`...) siguen el mismo contrato. Replicarlo mantiene el comportamiento predecible: el modal es *tonto* (valida, muestra errores, se cierra) y la **página** hace la llamada al servicio, el toast y la recarga. Plantilla completa y probada en `references/modal-template.md`; modelo real para copiar: `frontend/src/app/users/components/UserModal.jsx`.

## Contrato

```jsx
<SupplierModal
  isOpen={modalOpen}
  onClose={() => { setModalOpen(false); setSelected(null); }}
  onSubmit={handleSave}          // async; LANZA el error si falla
  initialData={selected}         // null = crear, objeto = editar
/>
```

- El modal **no** llama a la API de guardado. `onSubmit(payload)` es una función `async` de la página; si lanza, el modal muestra `err.message` en su banner y **permanece abierto**; si resuelve, el modal llama a `onClose()`.
- La página, en `handleSave`: llama al service (`update` si hay `selected`, `create` si no), muestra `showSuccessToast`, y `loadData()`. Si ya muestra el error con `showErrorAlert`, vuelve a lanzarlo (`throw err`) para que el modal no se cierre.
- Props extra: `categories`, `user`, `ingredient`, etc. con default (`= []`, `= null`).

## Anatomía obligatoria

1. **Estado**: un `useState` por campo (o un objeto `formData`), más `error` (string), `saving` (bool) e `isSubmittingRef = useRef(false)`.
2. **Reinicio al abrir**: `useEffect(() => { isSubmittingRef.current = false; if (isOpen) { setError(''); /* poblar desde initialData o valores por defecto */ } }, [isOpen, initialData])`. Sin esto el modal conserva datos de la vez anterior.
3. **`if (!isOpen) return null;` va DESPUÉS de todos los hooks** (reglas de hooks). Si tienes `useMemo`/`useEffect` extra, declara todo antes de ese `return`.
4. **`handleSubmit`**: `e.preventDefault()` -> `if (saving || isSubmittingRef.current) return;` -> `setError('')` -> validar y `return` con `setError(...)` si falla -> `isSubmittingRef.current = true; setSaving(true);` -> `try { await onSubmit(payload); onClose(); } catch (err) { setError(err.message || '...'); } finally { isSubmittingRef.current = false; setSaving(false); }`.
   *Por qué la ref*: `saving` (estado) se actualiza en el siguiente render; dos clics rápidos entran antes. La ref bloquea al instante (fue un bug real: commit `isSubmittingRef double-click protection`).
5. **Payload limpio**: `trim()` en textos, `Number(...)` en números, y para opcionales `valor.trim() || null`. Recuerda: `undefined` = "no tocar" en el backend; **`null` = limpiar**. Si usas `|| undefined` en edición, el usuario no podrá vaciar el campo (bug actual de `ProductModal` con la descripción).
6. **Crear vs. editar**: `const isEditing = Boolean(initialData);` para títulos, textos del botón ("Crear X" / "Guardar cambios"), campos que no se editan aquí (deshabilitados con una pista: p. ej. stock actual -> "Usa Ajustar Stock") y campos que solo existen al crear (contraseña inicial).
7. **Validación de formulario** en el modal con mensajes en español en el banner; el HTML `required` ayuda pero no basta. Para reglas de negocio reutiliza funciones de `utils/` (p. ej. `isValidPassword6`).
8. **Estructura visual**: overlay + panel + header + body + footer según `frontend-design-system` (receta "Modal completo"). Botones del footer: Cancelar (`type="button"`, `disabled={saving}`) y principal (`type="submit"`, spinner `RefreshCw`, texto `Guardando...`).

## Variantes

| Necesidad | Qué cambia | Modelo real |
|---|---|---|
| Solo lectura (ticket, detalle) | sin `onSubmit`; recibe el objeto y un botón "Cerrar" | `OrderDetailModal.jsx` |
| Carga datos al abrir | `useEffect([isOpen, id])` con `loading`/`error`, skeleton mientras carga | `KardexModal.jsx`, `SessionDetailModal.jsx` |
| Selector con búsqueda remota | `CustomSelect` (`common/`) con `loadOptions` | `ProductModal.jsx` (insumos de la receta) |
| Lista editable (filas) | arreglo en estado + añadir/quitar fila + validar filas | `ProductModal.jsx`, `CreateOrderModal.jsx` |
| Conteo con totales en vivo | `useMemo` con el total, deshabilitar enviar si total = 0 | `OpenCajaModal.jsx` |
| Confirmación previa a enviar | `await confirmDialog(...)` antes de `setSaving` (con la ref activada) | `CloseCajaModal.jsx` |
| Gestión de una sublista dentro del modal | formulario + lista con acciones propias, sin `onSubmit` global | `CategoryModal.jsx` |

No construyas modales de confirmación a medida: usa `confirmDialog` (`frontend-alerts-dialogs`).

## Terminado cuando

- [ ] Abrir -> cerrar -> reabrir (crear y editar) deja el formulario limpio / correctamente poblado.
- [ ] Doble clic rápido en guardar envía una sola petición.
- [ ] Error del servidor aparece en el banner y el modal sigue abierto; éxito cierra y la página recarga.
- [ ] Se puede vaciar un campo opcional al editar (envía `null`) y el backend lo acepta.
- [ ] Teclado: Enter envía el formulario, el primer campo tiene foco lógico (`autoFocus` si es un modal corto).
- [ ] `npm run build` sin errores y sin warnings de hooks condicionales.
