import React from 'react';
import { DollarSign, Users, Activity, TrendingUp } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';

const CATEGORY_CONFIG = {
  revenue: {
    icon: DollarSign,
    iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    accentGlow: "from-emerald-500/10 to-transparent",
  },
  users: {
    icon: Users,
    iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    accentGlow: "from-blue-500/10 to-transparent",
  },
  system: {
    icon: Activity,
    iconBg: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
    accentGlow: "from-indigo-500/10 to-transparent",
  },
};

export default function MetricCard({ metric }) {
  const config = CATEGORY_CONFIG[metric.category] || CATEGORY_CONFIG.revenue;
  const Icon = config.icon;

  const formattedValue =
    metric.type === 'currency'
      ? formatCurrency(metric.rawValue)
      : metric.type === 'percentage'
      ? `${metric.rawValue}%`
      : `+${formatNumber(metric.rawValue)}`;

  const formattedChange = formatPercentage(metric.change);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800 p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 group">
      {/* Background glow accent */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.accentGlow} opacity-50 group-hover:opacity-100 transition-opacity`} />

      <div className="relative z-10">
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

        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-800/60">
          <div className="flex items-center text-xs font-semibold text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            {formattedChange}
          </div>
          <span className="text-xs text-slate-500">{metric.description}</span>
        </div>
      </div>
    </div>
  );
}
