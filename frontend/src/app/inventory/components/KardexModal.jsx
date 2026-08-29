import React, { useState, useEffect } from 'react';
import { X, History, ArrowUpRight, ArrowDownRight, RefreshCw, FileText } from 'lucide-react';
import { fetchInventoryMovements, fetchIngredientDetail } from '../services/inventoryService';
import { REASON_LABELS, formatQuantity } from '../utils/inventoryUtils';

export default function KardexModal({
  isOpen,
  onClose,
  ingredient = null,
}) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');

      const fetchPromise = ingredient
        ? fetchIngredientDetail(ingredient.id).then((res) => res.inventoryMovements || [])
        : fetchInventoryMovements();

      fetchPromise
        .then((data) => {
          setMovements(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'No se pudieron cargar los movimientos de Kardex.');
          setLoading(false);
        });
    }
  }, [isOpen, ingredient]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                {ingredient ? `Kardex: ${ingredient.name}` : 'Historial Global de Kardex'}
              </h2>
              <p className="text-xs text-slate-400">
                {ingredient
                  ? `Últimos movimientos de bodega para este insumo (${ingredient.measurementUnit})`
                  : 'Registro de todas las entradas, salidas y ajustes de inventario'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] text-center">
              {error}
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-[#584235]">No hay movimientos registrados</p>
              <p className="text-xs">Aún no se han generado entradas o salidas en este insumo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 px-3">Fecha y Hora</th>
                    {!ingredient && <th className="pb-3 px-3">Insumo</th>}
                    <th className="pb-3 px-3">Tipo</th>
                    <th className="pb-3 px-3 text-right">Cantidad</th>
                    <th className="pb-3 px-3">Motivo</th>
                    <th className="pb-3 px-3 text-right">Stock Anterior → Stock Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#584235]">
                  {movements.map((mov) => {
                    const isEntry = mov.type === 'IN';
                    const isWaste = mov.type === 'OUT' || mov.reason === 'WASTE';
                    const dateFormatted = new Date(mov.date || mov.createdAt || mov.created_at || Date.now()).toLocaleString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const unit = mov.ingredient?.measurementUnit || ingredient?.measurementUnit || '';
                    const previousStock = Number(mov.previousStock) || 0;
                    const finalStock = mov.newStock !== undefined && mov.newStock !== null
                      ? Number(mov.newStock)
                      : mov.finalStock !== undefined && mov.finalStock !== null
                      ? Number(mov.finalStock)
                      : previousStock + (isEntry ? Math.abs(mov.quantity) : -Math.abs(mov.quantity));

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-3 text-slate-500 font-normal whitespace-nowrap">
                          {dateFormatted}
                        </td>

                        {/* Ingredient Name (if global) */}
                        {!ingredient && (
                          <td className="py-3 px-3 font-bold text-[#584235]">
                            {mov.ingredient?.name || `Insumo #${mov.ingredientId}`}
                          </td>
                        )}

                        {/* Type Badge */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isEntry
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : isWaste
                                ? 'bg-rose-50 text-[#E63946] border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isEntry ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                            {mov.type}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-right font-extrabold text-sm">
                          <span className={isEntry ? 'text-emerald-600' : 'text-[#E63946]'}>
                            {isEntry ? '+' : '-'}{formatQuantity(Math.abs(mov.quantity), unit)}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-600">
                            {REASON_LABELS[mov.reason] || mov.reason}
                          </span>
                        </td>

                        {/* Previous -> Final Stock */}
                        <td className="py-3 px-3 text-right text-slate-500 font-mono">
                          <span className="text-slate-400">{formatQuantity(previousStock, unit)}</span>
                          <span className="mx-1.5 text-slate-300 font-bold">→</span>
                          <span className="font-bold text-[#584235]">{formatQuantity(finalStock, unit)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
