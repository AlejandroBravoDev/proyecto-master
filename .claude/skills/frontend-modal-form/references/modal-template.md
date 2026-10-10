# Plantilla de modal crear/editar (ejemplo: SupplierModal)

Copia, renombra (`Supplier` -> tu entidad) y ajusta campos, textos e icono. Recetas de clases: `frontend-design-system/references/class-recipes.md`.

```jsx
// frontend/src/app/suppliers/components/SupplierModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, Edit3, AlertCircle, RefreshCw } from 'lucide-react';

export default function SupplierModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  // Populate or reset the form each time the modal opens (no API calls here)
  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen) {
      setError('');
      setName(initialData?.name || '');
      setPhone(initialData?.phone || '');
      setEmail(initialData?.email || '');
      setActive(initialData?.active ?? true);
    }
  }, [isOpen, initialData]);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');

    const cleanName = name.trim();
    if (!cleanName) {
      setError('El nombre del proveedor es obligatorio.');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      await onSubmit({
        name: cleanName,
        // null clears the column on the backend; undefined would leave it untouched
        phone: phone.trim() || null,
        email: email.trim() || null,
        ...(isEditing ? { active } : {}),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el proveedor.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-brand-red flex items-center justify-center">
              {isEditing ? <Edit3 className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-brand-text">
                {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Actualiza los datos del proveedor' : 'Registra un proveedor de insumos'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-brand-red flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Nombre <span className="text-brand-red">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Distribuidora Los Andes"
              className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 300 123 4567"
                className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ventas@proveedor.com"
                className="w-full px-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          {/* Only editable when editing */}
          {isEditing && (
            <div className="flex items-center space-x-3 pt-1">
              <input
                type="checkbox"
                id="supplierActive"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-5 h-5 rounded-lg text-brand-red focus:ring-brand-red border-slate-300 cursor-pointer"
              />
              <label htmlFor="supplierActive" className="text-sm font-semibold text-brand-text cursor-pointer">
                Proveedor activo
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## Handler en la página (contrato con el modal)

```jsx
const handleSaveSupplier = async (payload) => {
  try {
    if (selectedSupplier) {
      await updateSupplier(selectedSupplier.id, payload);
      showSuccessToast(`Proveedor "${payload.name}" actualizado correctamente.`);
    } else {
      await createSupplier(payload);
      showSuccessToast(`Proveedor "${payload.name}" registrado exitosamente.`);
    }
    loadData();
  } catch (err) {
    // El modal también muestra err.message en su banner; relanzar mantiene el modal abierto
    showErrorAlert('Error al guardar proveedor', err.message || 'No se pudo completar la operación.');
    throw err;
  }
};
```

Si prefieres mostrar el error **solo** en el banner del modal (lo más habitual para validaciones de servidor como "ya existe"), omite el `showErrorAlert` y deja que el error se propague tal cual; usa la alerta solo para fallos que el usuario no puede corregir en el formulario.

## Modal de solo lectura (esqueleto)

```jsx
export default function SupplierDetailModal({ isOpen, onClose, supplier = null }) {
  if (!isOpen || !supplier) return null; // sin hooks propios -> el return anticipado es seguro
  return ( /* mismo overlay/panel/header; body con los datos; footer con botón "Cerrar" */ );
}
```
