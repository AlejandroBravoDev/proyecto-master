import React, { useState, useEffect, useMemo } from 'react';
import { X, Unlock, Banknote, Coins, AlertCircle, RefreshCw, DollarSign } from 'lucide-react';
import { CASH_DENOMINATIONS, calculateDenominationsTotal, formatCurrency } from '../utils/cajaUtils';

export default function OpenCajaModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const [denominations, setDenominations] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setNotes('');
      // Initialize with 0 for all denominations
      const initialCounts = {};
      CASH_DENOMINATIONS.forEach((d) => {
        initialCounts[d.value.toString()] = 0;
      });
      setDenominations(initialCounts);
    }
  }, [isOpen]);

  // Calculations (unconditional hook)
  const totalBase = useMemo(() => {
    return calculateDenominationsTotal(denominations);
  }, [denominations]);

  const handleCountChange = (valStr, countStr) => {
    const qty = Math.max(0, parseInt(countStr || '0', 10) || 0);
    setDenominations((prev) => ({
      ...prev,
      [valStr]: qty,
    }));
  };

  const handleQuickAdd = (valStr, delta) => {
    setDenominations((prev) => {
      const current = prev[valStr] || 0;
      const nextVal = Math.max(0, current + delta);
      return {
        ...prev,
        [valStr]: nextVal,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (totalBase <= 0) {
      setError('Debes ingresar al menos una moneda o billete para fijar la base inicial.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        denominations,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo abrir la caja registradora.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const coins = CASH_DENOMINATIONS.filter((d) => d.type === 'COIN');
  const bills = CASH_DENOMINATIONS.filter((d) => d.type === 'BILL');

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
              <p className="text-xs text-slate-400">Ingresa el conteo de la base inicial para dar cambio</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Coins section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-extrabold text-[#584235] border-b border-slate-100 pb-1.5">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>Monedas Metálicas</span>
              </div>

              <div className="space-y-2">
                {coins.map((c) => {
                  const valKey = c.value.toString();
                  const count = denominations[valKey] || 0;
                  const rowSubtotal = c.value * count;

                  return (
                    <div
                      key={valKey}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#F8F9FA] border border-slate-200/80 text-xs"
                    >
                      <span className="font-black text-[#584235] w-12">{c.label}</span>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(valKey, -5)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px]"
                          title="Restar 5"
                        >
                          -5
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={count === 0 ? '' : count}
                          onChange={(e) => handleCountChange(valKey, e.target.value)}
                          placeholder="0"
                          className="w-14 px-2 py-1 rounded-lg bg-white border border-slate-300 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-[#E63946]"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(valKey, 5)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px]"
                          title="Sumar 5"
                        >
                          +5
                        </button>
                      </div>

                      <span className="font-bold text-slate-500 w-16 text-right">
                        {formatCurrency(rowSubtotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bills section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-extrabold text-[#584235] border-b border-slate-100 pb-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Billetes de Papel</span>
              </div>

              <div className="space-y-2">
                {bills.map((b) => {
                  const valKey = b.value.toString();
                  const count = denominations[valKey] || 0;
                  const rowSubtotal = b.value * count;

                  return (
                    <div
                      key={valKey}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#F8F9FA] border border-slate-200/80 text-xs"
                    >
                      <span className="font-black text-[#584235] w-12">{b.label}</span>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(valKey, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px]"
                          title="Restar 1"
                        >
                          -1
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={count === 0 ? '' : count}
                          onChange={(e) => handleCountChange(valKey, e.target.value)}
                          placeholder="0"
                          className="w-14 px-2 py-1 rounded-lg bg-white border border-slate-300 text-center font-bold text-slate-800 text-xs focus:outline-none focus:border-[#E63946]"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(valKey, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-[10px]"
                          title="Sumar 1"
                        >
                          +1
                        </button>
                      </div>

                      <span className="font-bold text-slate-500 w-16 text-right">
                        {formatCurrency(rowSubtotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
