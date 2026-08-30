import React from 'react';
import { Search, Plus, FolderPlus, CheckCircle, XCircle, Grid } from 'lucide-react';

export default function ProductHeaderCard({
  searchTerm,
  onSearchChange,
  availabilityFilter,
  onAvailabilityFilterChange,
  onNewProductClick,
  onManageCategoriesClick,
}) {
  const availabilityTabs = [
    { id: 'all', label: 'Todos los Estados', icon: Grid },
    { id: 'available', label: 'Disponibles', icon: CheckCircle },
    { id: 'unavailable', label: 'No Disponibles', icon: XCircle },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
      {/* Top Row: Title on Left, Actions on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#584235] tracking-tight">
            Catálogo de Productos
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Gestión de menú, precios de venta, recetas y disponibilidad para venta.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onManageCategoriesClick}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#584235] text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span>Categorías</span>
          </button>

          <button
            onClick={onNewProductClick}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Lower Row: Search Bar on Left + Availability Switcher on Right */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar producto por nombre o descripción..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Availability Filter Tabs */}
        <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 self-start lg:self-auto border border-slate-200">
          {availabilityTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = availabilityFilter === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onAvailabilityFilterChange(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
                    : 'text-slate-500 hover:text-[#584235]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E63946]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
