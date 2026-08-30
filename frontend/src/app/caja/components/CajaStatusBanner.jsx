import React from 'react';
import { Lock, Unlock, Clock, Banknote, History } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/cajaUtils';

export default function CajaStatusBanner({
  cajaStatus,
  onOpenCajaClick,
  onCloseCajaClick,
  onViewHistoryClick,
}) {
  const isOpen = cajaStatus?.isOpen;
  const activeSession = cajaStatus?.activeSession;
  const lastClosedSession = cajaStatus?.lastClosedSession;

  if (isOpen && activeSession) {
    return (
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/30 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left Info: Active Session & Timestamps */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black tracking-wider uppercase border border-emerald-500/30">
                Turno en Curso (Caja Abierta)
              </span>
              <span className="text-slate-300 text-xs font-mono font-bold">
                {activeSession.sessionNumber}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Apertura: {formatDateTime(activeSession.openedAt)}</span>
              {activeSession.notes && (
                <span className="text-slate-400 italic">· "{activeSession.notes}"</span>
              )}
            </div>
          </div>

          {/* Center Info: Initial Float Amount */}
          <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl px-5 py-3 border border-emerald-500/40">
            <span className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider block">
              Base Inicial de Cambio
            </span>
            <span className="text-2xl font-black text-emerald-300">
              {formatCurrency(activeSession.initialAmount)}
            </span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2.5 self-end lg:self-center">
            <button
              onClick={onViewHistoryClick}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/10"
              title="Auditoría de turnos anteriores"
            >
              <History className="w-4 h-4" />
              <span>Historial</span>
            </button>

            <button
              onClick={onCloseCajaClick}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Cerrar Caja / Finalizar Turno</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Caja Cerrada state
  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-slate-700 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Left: Closed Alert */}
        <div className="space-y-2">
          <div className="flex items-center space-x-3">
            <span className="inline-flex rounded-full h-3 w-3 bg-rose-500" />
            <span className="px-3 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-black tracking-wider uppercase border border-rose-500/30">
              Caja Registradora Cerrada
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-lg">
            No hay un turno de caja activo. Abre la caja ingresando la base inicial de monedas y billetes para dar cambio.
          </p>
        </div>

        {/* Center: Last Session summary if available */}
        {lastClosedSession && (
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 flex items-center space-x-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Último Cierre ({lastClosedSession.sessionNumber})
              </span>
              <span className="font-bold text-slate-200">
                {formatDateTime(lastClosedSession.closedAt)}
              </span>
            </div>

            <div className="border-l border-slate-700 pl-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Base Inicial</span>
              <span className="font-bold text-slate-300">
                {formatCurrency(lastClosedSession.initialAmount)}
              </span>
            </div>

            <div className="border-l border-slate-700 pl-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Conteo Final</span>
              <span className="font-black text-emerald-400">
                {formatCurrency(lastClosedSession.finalAmount)}
              </span>
            </div>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center space-x-2.5 self-end lg:self-center">
          <button
            onClick={onViewHistoryClick}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/10"
          >
            <History className="w-4 h-4" />
            <span>Historial Arqueos</span>
          </button>

          <button
            onClick={onOpenCajaClick}
            className="flex items-center space-x-1.5 px-6 py-3 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-black shadow-lg shadow-red-500/30 transition-all cursor-pointer"
          >
            <Unlock className="w-4 h-4" />
            <span>Abrir Caja / Iniciar Turno</span>
          </button>
        </div>
      </div>
    </div>
  );
}
