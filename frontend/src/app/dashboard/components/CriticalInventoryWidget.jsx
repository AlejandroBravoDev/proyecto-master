import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function CriticalInventoryWidget({ ingredients = [] }) {
  const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between min-h-70">
      <h2 className="text-lg font-bold text-brand-text mb-4">Estado de inventario (Crítico)</h2>

      {!hasIngredients ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-brand-text">Inventario en estado óptimo</p>
          <p className="text-xs text-slate-400 mt-1">No hay insumos con stock crítico en este momento.</p>
        </div>
      ) : (
        <div className="space-y-5 flex-1 flex flex-col justify-around">
          {ingredients.map((item, idx) => {
            const rawPercentage = Number(item.percentageRemaining) || 0;
            const percentage = Math.max(0, Math.min(100, Math.round(rawPercentage)));
            const isCritical = percentage <= 20;

            return (
              <div key={item.id || idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-brand-text truncate max-w-[70%]">{item.name}</span>
                  <span className={isCritical ? 'text-brand-red font-extrabold' : 'text-slate-400'}>
                    {percentage}% Restante
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCritical ? 'bg-brand-red' : 'bg-brand-orange'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
