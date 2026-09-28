import React from 'react';
import { Search, Plus, DollarSign, ClipboardList, Filter, Calendar, Lock, Unlock } from 'lucide-react';
import { formatCurrency } from '../utils/orderUtils';

export default function OrderHeaderCard({
  searchTerm,
  onSearchChange,
  onNewOrderClick,
  totalOrdersCount = 0,
  totalSalesAmount = 0,
  isAdmin = false,
  filterMode = 'active',
  onFilterModeChange,
  selectedDate = '',
  onSelectedDateChange,
  cajaIsOpen = true,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
      {/* Top Row: Title on Left, New Order Action on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold text-[#584235] tracking-tight">
              Gestión de Comandas
            </h1>
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                cajaIsOpen
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {cajaIsOpen ? (
                <>
                  <Unlock className="w-3 h-3 text-emerald-600" />
                  <span>Caja Abierta</span>
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 text-rose-600" />
                  <span>Caja Cerrada</span>
                </>
              )}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Toma de pedidos, tickets de cocina y registro automático en inventario.
          </p>
        </div>

        {/* Primary Action Button */}
        <div>
          <button
            type="button"
            onClick={onNewOrderClick}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Comanda (POS)</span>
          </button>
        </div>
      </div>

      {/* Lower Row: Search Bar + Admin Scope/Date Filter on Left + Real-time Mini Metrics on Right */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-2 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por número (ej: ORD-0001) o notas de mesa..."
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Exclusive Admin Filter: Current Shift vs By Date vs Full History */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterMode}
                  onChange={(e) => onFilterModeChange && onFilterModeChange(e.target.value)}
                  className="pl-9 pr-8 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs font-bold text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all cursor-pointer"
                >
                  <option value="active">Turno Actual (Activas)</option>
                  <option value="date">Por Fecha / Días Anteriores</option>
                  <option value="all">Todas las Comandas (Historial Completo)</option>
                </select>
              </div>

              {filterMode === 'date' && (
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onSelectedDateChange && onSelectedDateChange(e.target.value)}
                    className="pl-9 pr-3.5 py-2 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs font-bold text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Summary Badges */}
        <div className="flex items-center space-x-3 self-start lg:self-auto flex-wrap gap-y-2">
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
            <span>{totalOrdersCount} Comanda{totalOrdersCount !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total Ventas: {formatCurrency(totalSalesAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
