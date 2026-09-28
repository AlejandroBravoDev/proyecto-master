import React from 'react';
import { Users, UserPlus, Search } from 'lucide-react';

export default function UsersHeader({
  onNewUserClick,
  searchTerm,
  onSearchChange,
  totalCount = 0,
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Module title & description */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E63946] flex items-center justify-center shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[#584235] tracking-tight">
              Gestión de Trabajadores y Personal
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Administración de usuarios, roles de acceso y credenciales del sistema POS
            </p>
          </div>
        </div>

        {/* Right: Add New Worker Button */}
        <button
          onClick={onNewUserClick}
          className="flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Registrar Nuevo Trabajador</span>
        </button>
      </div>

      {/* Filter and Count row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar trabajador por nombre o usuario..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
          />
        </div>

        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {totalCount} Trabajador{totalCount !== 1 ? 'es' : ''} registrado{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
