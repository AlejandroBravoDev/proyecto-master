import React from 'react';
import { History, Eye, Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/cajaUtils';

export default function SessionHistoryTable({
  sessions = [],
  searchTerm = '',
  onSearchChange,
  onViewSessionDetail,
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6 md:p-8">
      {/* Table Header: Title on Left, Search + Counter on Right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#584235]">
              Historial de Sesiones de Caja (Aperturas y Cierres)
            </h3>
            <p className="text-xs text-slate-400">
              Registro histórico de bases iniciales y conteos finales de efectivo
            </p>
          </div>
        </div>

        {/* Search & Counter */}
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por turno (ej: CAJA-2026)..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium w-48 sm:w-60"
            />
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl whitespace-nowrap">
            {sessions.length} Turno{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
              <th className="py-3 px-4">Turno</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Fecha Apertura</th>
              <th className="py-3 px-4">Fecha Cierre</th>
              <th className="py-3 px-4 text-right">Base Inicial</th>
              <th className="py-3 px-4 text-right">Conteo Final</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#584235]">
            {sessions.map((s) => {
              const isClosed = s.status === 'CLOSED';

              return (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Session # */}
                  <td className="py-3.5 px-4 font-black text-[#584235]">
                    {s.sessionNumber}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isClosed
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isClosed ? 'bg-slate-400' : 'bg-emerald-500'
                        }`}
                      />
                      {isClosed ? 'Cerrado' : 'Abierto'}
                    </span>
                  </td>

                  {/* Open Time */}
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {formatDateTime(s.openedAt)}
                  </td>

                  {/* Close Time */}
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {s.closedAt ? formatDateTime(s.closedAt) : '—'}
                  </td>

                  {/* Base Inicial */}
                  <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                    {formatCurrency(s.initialAmount)}
                  </td>

                  {/* Conteo Final */}
                  <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                    {isClosed ? formatCurrency(s.finalAmount || 0) : '—'}
                  </td>

                  {/* View Detail Action */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => onViewSessionDetail(s.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-[#E63946] hover:text-white text-[#584235] text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Ver desglose de monedas y billetes"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Desglose</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
