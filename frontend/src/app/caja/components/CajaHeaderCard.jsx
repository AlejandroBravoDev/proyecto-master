import React from 'react';
import { Search, Plus, DollarSign, Receipt, Banknote, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils/cajaUtils';

export default function CajaHeaderCard({
  searchTerm,
  onSearchChange,
  onNewSaleClick,
  totalRevenue = 0,
  cashTotal = 0,
  digitalTotal = 0,
  invoicesCount = 0,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6">
      {/* Top Row: Title on Left, Action on Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#584235] tracking-tight">
            Caja y Facturación
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">
            Control de cobranzas, emisión de facturas fiscales y arqueo de métodos de pago.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={onNewSaleClick}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cobro Directo en Caja</span>
          </button>
        </div>
      </div>

      {/* Mini KPI Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
        {/* Total Revenue */}
        <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200/80 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Recaudado en Caja
            </span>
            <span className="text-xl font-black text-[#584235]">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>

        {/* Cash vs Digital */}
        <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
              Efectivo en Caja
            </span>
            <span className="text-xl font-black text-emerald-800">
              {formatCurrency(cashTotal)}
            </span>
          </div>
        </div>

        {/* Invoices Count */}
        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/70 flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
              Pagos Digitales (Tarjeta/Transf)
            </span>
            <span className="text-xl font-black text-blue-800">
              {formatCurrency(digitalTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Lower Row: Search Bar */}
      <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por número de factura (ej: INV-2026-0001)..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="text-xs font-bold text-slate-500">
          Mostrando {invoicesCount} factura{invoicesCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
