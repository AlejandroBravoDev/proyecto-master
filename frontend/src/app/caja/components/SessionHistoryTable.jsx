import React, { useState, useEffect, useMemo } from 'react';
import { History, Eye, Search, Edit3, User } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/cajaUtils';
import Pagination, { ITEMS_PER_PAGE } from '../../common/Pagination';

export default function SessionHistoryTable({
  sessions = [],
  searchTerm = '',
  onSearchChange,
  onViewSessionDetail,
  onEditSession,
  isAdmin = false,
  employees = [],
  selectedEmployeeId = '',
  onEmployeeChange,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEmployeeId, sessions.length]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedSessions = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return sessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sessions, safePage]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header: Title on Left, Search + Employee Filter + Counter on Right */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 p-6 md:px-8 md:py-6">
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

        {/* Search, Employee Select (Admin) & Counter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setCurrentPage(1);
                onSearchChange(e.target.value);
              }}
              placeholder="Buscar por turno (ej: CAJA-2026)..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium w-48 sm:w-56"
            />
          </div>

          {isAdmin && (
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setCurrentPage(1);
                  if (onEmployeeChange) onEmployeeChange(e.target.value);
                }}
                className="pl-8 pr-7 py-1.5 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs font-bold text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all cursor-pointer"
              >
                <option value="">Todos los empleados</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.fullName || emp.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl whitespace-nowrap">
            {sessions.length} Turno{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table Scroll Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/95">
              <th className="py-3 px-6">Turno</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Abierta por</th>
              <th className="py-3 px-4">Fecha Apertura</th>
              <th className="py-3 px-4">Fecha Cierre</th>
              <th className="py-3 px-4 text-right">Base Inicial</th>
              <th className="py-3 px-4 text-right">Conteo Final</th>
              <th className="py-3 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#584235]">
            {paginatedSessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  No se encontraron sesiones de caja registradas.
                </td>
              </tr>
            ) : (
              paginatedSessions.map((s) => {
                const isClosed = s.status === 'CLOSED';
                const openedByName =
                  s.openedByUser?.fullName || s.openedByUser?.username || 'Sistema';

                return (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Session # */}
                    <td className="py-3.5 px-6 font-black text-[#584235]">
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

                    {/* Opened By */}
                    <td className="py-3.5 px-4 font-bold text-[#584235] whitespace-nowrap">
                      {openedByName}
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

                    {/* Actions */}
                    <td className="py-3.5 px-6 text-center">
                      <div className="inline-flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onViewSessionDetail(s.id)}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-slate-100 hover:bg-[#E63946] hover:text-white text-[#584235] text-xs font-bold transition-all cursor-pointer shadow-xs"
                          title="Ver desglose de monedas y billetes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Desglose</span>
                        </button>

                        {isAdmin && onEditSession && (
                          <button
                            type="button"
                            onClick={() => onEditSession(s)}
                            className="inline-flex items-center space-x-1 px-3 py-1 rounded-xl bg-amber-50 hover:bg-[#584235] hover:text-white text-[#584235] border border-amber-200/80 text-xs font-bold transition-all cursor-pointer shadow-xs"
                            title="Editar montos y observaciones de esta sesión"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={safePage}
        totalItems={sessions.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
