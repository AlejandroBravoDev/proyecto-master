import React from 'react';
import {
  Search,
  Plus,
  AlertTriangle,
  Layers,
  History,
  FileSpreadsheet,
  Download,
  UploadCloud
} from 'lucide-react';

export default function InventoryHeaderCard({
  searchTerm,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onNewIngredientClick,
  onViewKardexClick,
  onDownloadTemplateClick,
  onExportExcelClick,
  onImportExcelClick,
  downloadingTemplate = false,
  exportingExcel = false,
  alertsCount = 0,
}) {
  const filters = [
    { id: 'all', label: 'Todos los Insumos', icon: Layers },
    { id: 'low_stock', label: 'Stock Bajo / Alertas', icon: AlertTriangle, badge: alertsCount },
  ];

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#584235] tracking-tight">
            Gestión de Inventario
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Control de materias primas, stock en bodega y movimientos de Kardex.
          </p>
        </div>

        {/* Action Buttons Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Template */}
          <button
            onClick={onDownloadTemplateClick}
            disabled={downloadingTemplate}
            title="Descargar plantilla Excel para carga masiva"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{downloadingTemplate ? 'Descargando...' : 'Descargar Plantilla'}</span>
          </button>

          {/* Export Report */}
          <button
            onClick={onExportExcelClick}
            disabled={exportingExcel}
            title="Exportar inventario actual a Excel"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>{exportingExcel ? 'Exportando...' : 'Exportar Excel'}</span>
          </button>

          {/* Bulk Import */}
          <button
            onClick={onImportExcelClick}
            title="Subir archivo Excel para importar insumos masivamente"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all cursor-pointer border border-emerald-200"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            <span>Importar Masivo</span>
          </button>

          {/* Global Kardex */}
          <button
            onClick={onViewKardexClick}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#584235] text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Kardex Global</span>
          </button>

          {/* New Ingredient */}
          <button
            onClick={onNewIngredientClick}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2 border-t border-slate-100">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar insumo por nombre o descripción..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 self-start md:self-auto border border-slate-200">
          {filters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;

            return (
              <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
                    : 'text-slate-500 hover:text-[#584235]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E63946]' : 'text-slate-400'}`} />
                <span>{filter.label}</span>
                {filter.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#E63946] text-white">
                    {filter.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
