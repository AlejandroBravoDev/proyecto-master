# Plantillas de listado (ejemplo: Suppliers)

## Contenido
- Utils de la feature
- Header card (título, acción, buscador)
- Tabla paginada
- Variante: grilla de tarjetas
- Filtrado y paginación en la página

## Utils de la feature

```js
// frontend/src/app/suppliers/utils/supplierUtils.js
/**
 * Pure JavaScript helpers for the Suppliers module (no React, no side effects).
 */

export const SUPPLIER_STATUS = {
  ACTIVE: {
    label: 'Activo',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Inactivo',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
};

/**
 * Returns the status descriptor (label + badge classes) of a supplier.
 * @param {{ active: boolean }} supplier
 */
export function getSupplierStatus(supplier) {
  return supplier.active ? SUPPLIER_STATUS.ACTIVE : SUPPLIER_STATUS.INACTIVE;
}

/**
 * Case-insensitive match of a supplier against a search term.
 * @param {{ name: string, email?: string|null, phone?: string|null }} supplier
 * @param {string} term
 */
export function matchesSupplierSearch(supplier, term) {
  const query = term.trim().toLowerCase();
  if (!query) return true;
  return (
    supplier.name.toLowerCase().includes(query) ||
    (supplier.email ? supplier.email.toLowerCase().includes(query) : false) ||
    (supplier.phone ? supplier.phone.toLowerCase().includes(query) : false)
  );
}
```

## Header card (título, acción, buscador)

```jsx
// frontend/src/app/suppliers/components/SupplierHeaderCard.jsx
import React from 'react';
import { Search, Plus } from 'lucide-react';

export default function SupplierHeaderCard({
  searchTerm,
  onSearchChange,
  onNewSupplierClick,
  totalCount = 0,
  isAdmin = false,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-text tracking-tight">Proveedores</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Gestión de los proveedores que abastecen los insumos del restaurante.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onNewSupplierClick}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-brand-red hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, email o teléfono..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-brand-bg border border-slate-200 text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-red focus:bg-white transition-all font-medium"
          />
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {totalCount} Proveedor{totalCount !== 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  );
}
```

## Tabla paginada

```jsx
// frontend/src/app/suppliers/components/SupplierTable.jsx
import React, { useMemo } from 'react';
import { Edit3, Trash2, Truck } from 'lucide-react';
import { getSupplierStatus } from '../utils/supplierUtils';
import Pagination, { ITEMS_PER_PAGE } from '../../common/Pagination';

export default function SupplierTable({
  suppliers = [],
  currentPage = 1,
  onPageChange,
  onEdit,
  onDelete,
  isAdmin = false,
}) {
  const totalPages = Math.max(1, Math.ceil(suppliers.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return suppliers.slice(start, start + ITEMS_PER_PAGE);
  }, [suppliers, safePage]);

  if (suppliers.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
        <Truck className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-brand-text">No se encontraron proveedores</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          No hay proveedores registrados con los criterios de búsqueda aplicados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-4 px-6">Proveedor</th>
              <th className="py-4 px-4">Teléfono</th>
              <th className="py-4 px-4">Email</th>
              <th className="py-4 px-4 text-center">Estado</th>
              {isAdmin && <th className="py-4 px-6 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium text-brand-text">
            {pageItems.map((supplier) => {
              const status = getSupplierStatus(supplier);

              return (
                <tr key={supplier.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-bold">{supplier.name}</td>
                  <td className="py-4 px-4 text-slate-500">{supplier.phone || '—'}</td>
                  <td className="py-4 px-4 text-slate-500">{supplier.email || '—'}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.dotClass}`} />
                      {status.label}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => onEdit(supplier)}
                          title="Editar proveedor"
                          className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(supplier)}
                          title="Eliminar proveedor"
                          className="p-2 rounded-xl text-slate-400 hover:text-brand-red hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safePage}
        totalItems={suppliers.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={onPageChange}
      />
    </div>
  );
}
```

## Variante: grilla de tarjetas

Contenedor en la página: `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map((item) => <SupplierCard key={item.id} supplier={item} onEdit={...} onDelete={...} isAdmin={isAdmin} />)}</div>`. La tarjeta usa la receta "Tarjetas (grilla)" de `frontend-design-system` (franja superior de color, badges, pie con acciones). Las tarjetas **no** se paginan en el modelo actual (ver `ProductsPage`); si hay cientos, pagina con `Pagination` igual que la tabla.

## Filtrado y paginación en la página

```jsx
const [searchTerm, setSearchTerm] = useState('');
const [currentPage, setCurrentPage] = useState(1);

// Volver a la página 1 cuando cambia cualquier filtro
useEffect(() => {
  setCurrentPage(1);
}, [searchTerm]);

const filteredSuppliers = useMemo(
  () => suppliers.filter((s) => matchesSupplierSearch(s, searchTerm)),
  [suppliers, searchTerm]
);
```

Con tabs (p. ej. `all | active | inactive`): añade `activeFilter` al estado, a la dependencia del `useEffect` de reinicio y al `filter`:

```jsx
const filteredSuppliers = useMemo(
  () => suppliers.filter((s) => {
    if (!matchesSupplierSearch(s, searchTerm)) return false;
    if (activeFilter === 'active' && !s.active) return false;
    if (activeFilter === 'inactive' && s.active) return false;
    return true;
  }),
  [suppliers, searchTerm, activeFilter]
);
```
