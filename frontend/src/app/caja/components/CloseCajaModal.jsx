import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils/cajaUtils';
import { useDenominationCounts } from '../hooks/useDenominationCounts';
import DenominationCounter from './DenominationCounter';
import { confirmDialog } from '../../common/alertUtils';
import { useAuth } from '../../auth/AuthContext';

export default function CloseCajaModal({
  isOpen,
  onClose,
  activeSession,
  onSubmit,
}) {
  const { user } = useAuth();
  const { denominations, total: finalAmount, setCount, quickAdd } = useDenominationCounts(isOpen);
  const [closingNotes, setClosingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen) {
      setError('');
      setClosingNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');
    isSubmittingRef.current = true;

    const confirmRes = await confirmDialog({
      title: '¿Confirmar cierre de caja?',
      text: `Total contado al cierre: ${formatCurrency(finalAmount)}. Esta acción cerrará la sesión de caja del día.`,
      confirmButtonText: 'Sí, cerrar caja',
      cancelButtonText: 'Revisar conteo',
    });

    if (!confirmRes.isConfirmed) {
      isSubmittingRef.current = false;
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        denominations,
        closingNotes: closingNotes.trim() || undefined,
        userId: user?.id,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la caja registradora.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  if (!isOpen || !activeSession) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                Cierre de Caja ({activeSession.sessionNumber})
              </h2>
              <p className="text-xs text-slate-400">
                Registra el conteo final · Cierra:{' '}
                <strong className="text-[#584235]">{user?.fullName || user?.username || 'Sistema'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Active Shift Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Base Inicial de Apertura
              </span>
              <span className="text-base font-black text-[#584235]">
                {formatCurrency(activeSession.initialAmount)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Abierta por
              </span>
              <span className="text-xs font-bold text-[#584235]">
                {activeSession.openedByUser?.fullName || activeSession.openedByUser?.username || 'Sistema'}
              </span>
            </div>

            {activeSession.notes && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nota de Apertura
                </span>
                <span className="text-xs text-slate-600 font-medium italic">
                  "{activeSession.notes}"
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Physical Count Table */}
          <DenominationCounter
            denominations={denominations}
            onCountChange={setCount}
            onQuickAdd={quickAdd}
            coinsTitle="Conteo de Monedas"
            billsTitle="Conteo de Billetes"
          />

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Observaciones del Cierre de Caja
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Ej: Cierre de jornada, dinero entregado a gerencia..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Contado en Caja</span>
            <span className="text-2xl font-black text-[#584235]">
              {formatCurrency(finalAmount)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Cerrando caja...' : 'Confirmar Cierre de Caja'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
