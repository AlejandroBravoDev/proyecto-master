# Plantilla de página (ejemplo: SuppliersPage)

Se apoya en: `services/` (`frontend-api-service/references/service-template.md`), `SupplierHeaderCard` + `SupplierTable` + `utils` (`frontend-data-views/references/templates.md`) y `SupplierModal` (`frontend-modal-form/references/modal-template.md`).

## Contenido
- Página
- Registro en el router
- Registro en el Sidebar
- Variante: pantalla de tarjetas
- Variante: pantalla de solo lectura / dashboard

## Página

```jsx
// frontend/src/app/suppliers/SuppliersPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import SupplierHeaderCard from './components/SupplierHeaderCard';
import SupplierTable from './components/SupplierTable';
import SupplierModal from './components/SupplierModal';
import { matchesSupplierSearch } from './utils/supplierUtils';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from './services/supplierService';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';
import { useAuth } from '../auth/AuthContext';

export default function SuppliersPage() {
  const { isAdmin } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchSuppliers()
      .then((data) => {
        setSuppliers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando proveedores:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar los proveedores.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Back to page 1 whenever a filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) => matchesSupplierSearch(s, searchTerm)),
    [suppliers, searchTerm]
  );

  // Handlers
  const handleOpenCreate = () => {
    if (!isAdmin) return;
    setSelectedSupplier(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier) => {
    if (!isAdmin) return;
    setSelectedSupplier(supplier);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedSupplier(null);
  };

  // The modal shows err.message in its banner and stays open when this throws
  const handleSaveSupplier = async (payload) => {
    if (selectedSupplier) {
      await updateSupplier(selectedSupplier.id, payload);
      showSuccessToast(`Proveedor "${payload.name}" actualizado correctamente.`);
    } else {
      await createSupplier(payload);
      showSuccessToast(`Proveedor "${payload.name}" registrado exitosamente.`);
    }
    loadData();
  };

  const handleDeleteSupplier = async (supplier) => {
    if (!isAdmin) return;

    const result = await confirmDialog({
      title: `¿Eliminar "${supplier.name}"?`,
      text: 'El proveedor se eliminará definitivamente del sistema.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
      await deleteSupplier(supplier.id);
      showSuccessToast('Proveedor eliminado correctamente.');
      loadData();
    } catch (err) {
      showErrorAlert('Error al eliminar proveedor', err.message || 'No se pudo eliminar el proveedor.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <SupplierHeaderCard
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onNewSupplierClick={handleOpenCreate}
        totalCount={suppliers.length}
        isAdmin={isAdmin}
      />

      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-brand-red shrink-0" />
            <div>
              <p className="font-bold text-brand-text">Error al conectar con la API de Proveedores</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : (
        <SupplierTable
          suppliers={filteredSuppliers}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteSupplier}
          isAdmin={isAdmin}
        />
      )}

      {/* Modal: create / edit (mounted always, hides itself with isOpen) */}
      {isAdmin && (
        <SupplierModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSaveSupplier}
          initialData={selectedSupplier}
        />
      )}
    </div>
  );
}
```

Nota: el estado vacío lo resuelve `SupplierTable` (mensaje + icono); si quieres un CTA "Crear primer proveedor" para admin, pásale `onNewSupplierClick` y muéstralo en esa rama.

## Registro en el router

```jsx
// frontend/src/app/router.jsx (fragmento: líneas a agregar al archivo existente)
import SuppliersPage from './suppliers/SuppliersPage';

// dentro de children: [...] de la ruta '/'
{
  path: 'proveedores',
  element: <SuppliersPage />,
},
// o, si es solo admin:
{
  path: 'proveedores',
  element: (
    <ProtectedRoute adminOnly>
      <SuppliersPage />
    </ProtectedRoute>
  ),
},
```

## Registro en el Sidebar

```jsx
// frontend/src/app/layouts/Sidebar.jsx (fragmento: líneas a agregar al archivo existente)
import { /* ...los existentes... */ Truck } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  // ...
  { name: 'Proveedores', path: '/proveedores', icon: Truck },
  // solo admin (como Usuarios):
  ...(isAdmin ? [{ name: 'Usuarios', path: '/usuarios', icon: Users }] : []),
];
```

Coloca el ítem donde tenga sentido de negocio (los operativos antes de los administrativos). Comprueba que el icono exista en `lucide-react` (un nombre inexistente rompe el build).

## Variante: pantalla de tarjetas

Reemplaza `SupplierTable` por la grilla de `frontend-data-views` y añade, si hay categorías/filtros, una `CategoryFilterBar`-style (tabs segmentados) sobre la header card como en `ProductsPage`. La carga paralela con `Promise.all([fetchItems(), fetchCategories().catch(() => [])])` evita que un fallo secundario bloquee la pantalla.

## Variante: pantalla de solo lectura / dashboard

Sin modales ni handlers de escritura: `loadData(period)` con `useCallback`, tarjeta de cabecera con selector de periodo (`DashboardHeaderCard`), grilla de `MetricCard` y widgets. Los datos vienen de un único endpoint de agregación; si el valor no lo calcula el backend, no lo muestres (nada de porcentajes fijos).
