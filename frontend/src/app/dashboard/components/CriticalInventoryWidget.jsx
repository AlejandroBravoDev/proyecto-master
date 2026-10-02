import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function CriticalInventoryWidget({ ingredients = [] }) {
  const navigate = useNavigate();
  const hasIngredients = Array.isArray(ingredients) && ingredients.length > 0;
  const visibleIngredients = hasIngredients ? ingredients.slice(0, 5) : [];

  const handleGoToAlerts = () => {
    navigate('/inventario?tab=alerts');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between min-h-70">
      {/* Header with Title, Badge, Subtitle and Action */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-brand-text">Estado de inventario (Crítico)</h2>
            {ingredients.length > 5 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#E63946] text-white shadow-sm">
                {ingredients.length}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Porcentaje calculado en base al stock mínimo configurado en inventario
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoToAlerts}
          className="inline-flex items-center space-x-1 text-xs font-bold text-[#E63946] hover:text-red-700 hover:underline transition-colors cursor-pointer shrink-0"
        >
          <span>Ver alertas</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasIngredients ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-brand-text">Inventario en estado óptimo</p>
          <p className="text-xs text-slate-400 mt-1">No hay insumos con stock crítico en este momento.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4 flex-1 flex flex-col justify-around py-1">
            {visibleIngredients.map((item, idx) => {
              const rawPercentage = Number(item.percentageRemaining) || 0;
              const percentage = Math.max(0, Math.min(100, Math.round(rawPercentage)));
              const isCritical = percentage <= 20;

              return (
                <div
                  key={item.id || idx}
                  onClick={handleGoToAlerts}
                  className="space-y-1.5 cursor-pointer group"
                  title="Ver alertas en Inventario"
                >
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-brand-text truncate max-w-[70%] group-hover:text-[#E63946] transition-colors">
                      {item.name}
                    </span>
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

          {/* Footer with count and navigation link when > 5 */}
          {ingredients.length > 5 && (
            <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>
                Mostrando 5 de {ingredients.length} insumos críticos.
              </span>
              <button
                type="button"
                onClick={handleGoToAlerts}
                className="inline-flex items-center space-x-1 font-bold text-[#E63946] hover:text-red-700 hover:underline cursor-pointer transition-colors"
              >
                <span>Ver todas las alertas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
