import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { ADJUSTMENT_REASONS, formatQuantity } from '../utils/inventoryUtils';

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onSubmit,
  ingredient = null,
}) {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('PURCHASE');
  const [unitCost, setUnitCost] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ingredient) {
      setQuantity(0);
      setReason('PURCHASE');
      setUnitCost(ingredient.unitCost ?? 0);
      setError('');
    }
  }, [ingredient, isOpen]);

  if (!isOpen || !ingredient) return null;

  const currentStock = Number(ingredient.currentStock) || 0;
  const numQuantity = Number(quantity) || 0;

  // Calculate projected new stock
  let projectedStock = currentStock;
  if (reason === 'PURCHASE') {
    projectedStock = currentStock + Math.abs(numQuantity);
  } else if (reason === 'WASTE') {
    projectedStock = Math.max(0, currentStock - Math.abs(numQuantity));
  } else {
    // MANUAL_ADJUSTMENT: directly the entered delta
    projectedStock = currentStock + numQuantity;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numQuantity === 0) {
      setError('La cantidad a ajustar no puede ser cero.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Calculate adjustStock with proper sign
      let finalAdjustStock = numQuantity;
      if (reason === 'PURCHASE') {
        finalAdjustStock = Math.abs(numQuantity);
      } else if (reason === 'WASTE') {
        finalAdjustStock = -Math.abs(numQuantity);
      }

      await onSubmit(ingredient.id, {
        adjustStock: finalAdjustStock,
        adjustReason: reason,
        unitCost: Number(unitCost) || ingredient.unitCost,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Error al procesar el ajuste de stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Ajustar Stock</h2>
              <p className="text-xs text-slate-400">Movimiento directo de Kardex en bodega</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Info Badge */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Insumo</span>
            <span className="font-bold text-sm text-[#584235]">{ingredient.name}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium block">Stock Actual</span>
            <span className="font-bold text-sm text-[#584235]">
              {formatQuantity(ingredient.currentStock, ingredient.measurementUnit)}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946]">
              {error}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-[#584235] mb-1">
              Motivo del Movimiento <span className="text-[#E63946]">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-bold text-[#584235] mb-1">
              Cantidad ({ingredient.measurementUnit}) <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={quantity || ''}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej. 10, 2.5"
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-bold"
            />
          </div>

          {/* Unit Cost if purchase */}
          {reason === 'PURCHASE' && (
            <div>
              <label className="block text-xs font-bold text-[#584235] mb-1">
                Nuevo Costo Unitario de Compra ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white"
              />
            </div>
          )}

          {/* Projection Indicator */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs">
            <span className="text-[#584235] font-semibold">Stock Proyectado:</span>
            <span className="font-extrabold text-sm text-[#584235]">
              {formatQuantity(projectedStock, ingredient.measurementUnit)}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#FF7A00] hover:bg-amber-600 text-white text-xs font-bold shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              <span>{submitting ? 'Procesando...' : 'Aplicar Ajuste'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
