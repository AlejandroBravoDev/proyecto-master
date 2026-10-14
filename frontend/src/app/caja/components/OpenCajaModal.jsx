import React, { useState, useEffect, useRef } from 'react';
import { X, Unlock, AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../utils/cajaUtils';
import { useDenominationCounts } from '../hooks/useDenominationCounts';
import DenominationCounter from './DenominationCounter';
import { useAuth } from '../../auth/AuthContext';

export default function OpenCajaModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const { user } = useAuth();
  const { denominations, total: totalBase, setCount, quickAdd } = useDenominationCounts(isOpen);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    isSubmittingRef.current = false;
    if (isOpen) {
      setError('');
      setNotes('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    setError('');

    if (totalBase <= 0) {
      setError('Debes ingresar al menos una moneda o billete para fijar la base inicial.');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    try {
      await onSubmit({
        denominations,
        notes: notes.trim() || undefined,
        userId: user?.id,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo abrir la caja registradora.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Apertura de Caja Registradora</h2>
              <p className="text-xs text-slate-400">
                Ingresa el conteo de la base inicial · Responsable:{' '}
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
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Denominations Grid */}
          <DenominationCounter
            denominations={denominations}
            onCountChange={setCount}
            onQuickAdd={quickAdd}
            coinsTitle="Monedas Metálicas"
            billsTitle="Billetes de Papel"
          />

          {/* Notes field */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Notas de Apertura (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Apertura turno matutino, base de cambio entregada por gerencia..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] font-medium"
            />
          </div>
        </div>

        {/* Footer & Total */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Base Inicial Total</span>
            <span className="text-2xl font-black text-emerald-600">
              {formatCurrency(totalBase)}
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
              disabled={saving || totalBase <= 0}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Abriendo caja...' : 'Iniciar Turno de Caja'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
