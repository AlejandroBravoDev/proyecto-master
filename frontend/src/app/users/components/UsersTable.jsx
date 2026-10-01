import React from 'react';
import { Edit3, KeyRound, Power, ShieldCheck, User, ChevronLeft, ChevronRight, UserX, UserCheck } from 'lucide-react';
import { formatDate, formatRole } from '../utils/userUtils';

export default function UsersTable({
  users = [],
  onEdit,
  onResetPassword,
  onToggleStatus,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6 md:p-8">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
              <th className="py-3 px-4">Trabajador / Personal</th>
              <th className="py-3 px-4">Usuario</th>
              <th className="py-3 px-4">Rol</th>
              <th className="py-3 px-4">Fecha de Ingreso</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#584235]">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  No se encontraron trabajadores registrados con los criterios de búsqueda.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isAdmin = u.role === 'ADMIN';
                const isActive = Boolean(u.active);

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Full Name & Avatar */}
                    <td className="py-3.5 px-4 font-bold text-[#584235]">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdmin
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <span className="font-extrabold">{u.fullName}</span>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                      @{u.username}
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isAdmin
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {formatRole(u.role)}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(u.joinedAt || u.createdAt)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => onEdit(u)}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          title="Editar datos del trabajador"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => onResetPassword(u)}
                          className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                          title="Reasignar contraseña (mínimo 6 caracteres)"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Toggle Status Button (Activate / Inactivate) */}
                        <button
                          onClick={() => onToggleStatus(u)}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}
                          title={isActive ? 'Desactivar / Inactivar trabajador' : 'Activar trabajador'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls (15 items per page) */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            Página {currentPage} de {totalPages}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-[#584235] px-2">
              {currentPage}
            </span>

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
