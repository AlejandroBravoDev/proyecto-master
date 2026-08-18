import React from 'react';
import { DollarSign, TrendingUp, ShoppingBag, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';

const CATEGORY_CONFIG = {
  totalRevenue: {
    icon: DollarSign,
    iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    accentGlow: "from-emerald-500/10 to-transparent",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  grossProfit: {
    icon: TrendingUp,
    iconBg: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    accentGlow: "from-indigo-500/10 to-transparent",
    badgeColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  },
  totalItemsSold: {
    icon: ShoppingBag,
    iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    accentGlow: "from-blue-500/10 to-transparent",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  stockAlertsCount: {
    icon: AlertTriangle,
    iconBg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    accentGlow: "from-amber-500/10 to-transparent",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
};

export default function MetricCard({ metric }) {
  const config = CATEGORY_CONFIG[metric.category] || CATEGORY_CONFIG.totalRevenue;
  const Icon = config.icon;

  const formattedValue =
    metric.type === 'currency'
      ? formatCurrency(metric.rawValue)
      : formatNumber(metric.rawValue);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800 p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 group">
      {/* Subtle top background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.accentGlow} opacity-50 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{metric.title}</span>
            <div className={`p-2.5 rounded-xl ${config.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formattedValue}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/60">
          <span className="text-xs text-slate-500">{metric.description}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.badgeColor}`}>
            KPI
          </span>
        </div>
      </div>
    </div>
  );
}
