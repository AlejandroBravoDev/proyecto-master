import React from 'react';
import { DollarSign, Banknote, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';

export default function MetricCard({ metric }) {
  const isStockAlert = metric.category === 'stockAlertsCount';
  const isUnits = metric.type === 'number' && !isStockAlert;

  const formattedValue = metric.type === 'currency'
    ? formatCurrency(metric.rawValue)
    : isUnits
    ? `${formatNumber(metric.rawValue)} und`
    : formatNumber(metric.rawValue);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      {/* Top Red Accent Header Bar */}
      <div className="h-3 bg-brand-red w-full rounded-t-3xl" />

      <div className="p-6 relative">
        {/* Title */}
        <span className="text-sm font-bold text-slate-500 block mb-2">{metric.title}</span>

        {/* Large Value */}
        <div className="text-3xl font-black text-brand-text tracking-tight mb-3">
          {formattedValue}
        </div>

        {/* Bottom Details & Watermark Icon */}
        <div className="flex items-center justify-between pt-2">
          {isStockAlert ? (
            <span className="text-xs font-semibold text-slate-400">Artículos por acabarse</span>
          ) : (
            <span className="inline-flex items-center text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">
              +2.5%
            </span>
          )}

          {/* Watermark Icon */}
          <div className="opacity-15 text-slate-400">
            {isStockAlert ? (
              <AlertTriangle className="w-10 h-10 text-brand-red opacity-40" />
            ) : (
              <Banknote className="w-12 h-12 text-slate-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
