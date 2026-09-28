import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, AlertCircle, RefreshCw, DollarSign, FileText } from 'lucide-react';
import { formatDateTime } from '../utils/cajaUtils';

export default function EditCajaSessionModal({
  isOpen,
  onClose,
  session = null,
  onSubmit,
}) {
  const [initialAmount, setInitialAmount] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  const isClosed = session?.status === 'CLOSED';

  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen && session) {
      setError('');
      setInitialAmount(
        session.initialAmount !== undefined && session.initialAmount !== null
          ? String(session.initialAmount)
          : '0'
      );
      setFinalAmount(
        session.finalAmount !== undefined && session.finalAmount !== null
          ? String(session.finalAmount)
          : '0'
      );
      setNotes(session.notes || '');
      setClosingNotes(session.closingNotes || '');
    }
  }, [isOpen, session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current || !session) return;

    setError('');

    const parsedInitial = parseFloat(initialAmount);
    if (isNaN(parsedInitial) || parsedInitial < 0) {
      setError('La base inicial debe ser un monto numérico válido mayor o igual a 0.');
      return;
    }

    let parsedFinal = undefined;
    if (isClosed) {
      parsedFinal = parseFloat(finalAmount);
      if (isNaN(parsedFinal) || parsedFinal < 0) {
        setError('El conteo final debe ser un monto numérico válido mayor o igual a 0.');
        return;
      }
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        initialAmount: Number(parsedInitial.toFixed(2)),
        ...(isClosed ? { finalAmount: Number(parsedFinal.toFixed(2)) } : {}),
        notes: notes.trim() || null,
        closingNotes: closingNotes.trim() || null,
      };

      await onSubmit(session.id, payload);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la sesión de caja.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                Editar Sesión de Caja ({session.sessionNumber})
              </h2>
              <p className="text-xs text-slate-400">
                Apertura: {formatDateTime(session.openedAt)} ·{' '}
                {session.openedByUser?.fullName || session.openedByUser?.username || 'Sistema'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Numeric Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Base Inicial (initialAmount)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-slate-200 text-sm font-bold text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-[#E63946]" />
                <span>Conteo Final (finalAmount)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={isClosed ? finalAmount : ''}
                onChange={(e) => setFinalAmount(e.target.value)}
                disabled={!isClosed}
                placeholder={!isClosed ? 'Sesión abierta' : '0.00'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] border border-slate-200 text-sm font-bold text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!isClosed && (
                <p className="text-[10px] text-slate-400">
                  Habilitado únicamente cuando la sesión está cerrada.
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notas de Apertura</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Base inicial turno matutino..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Closing Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Observaciones de Cierre</span>
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Ej: Cierre cuadrado sin novedades..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
