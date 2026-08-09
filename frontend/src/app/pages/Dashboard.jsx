import React from 'react';
import { DollarSign, Users, Activity, TrendingUp, ArrowUpRight } from 'lucide-react';

export default function Dashboard() {
  const cards = [
    {
      id: 1,
      title: "Ingresos Totales",
      value: "$45,231.89",
      change: "+20.1%",
      description: "respecto al mes anterior",
      icon: DollarSign,
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      accentGlow: "from-emerald-500/10 to-transparent",
    },
    {
      id: 2,
      title: "Usuarios Activos",
      value: "+2,350",
      change: "+180.1%",
      description: "respecto a la semana pasada",
      icon: Users,
      iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      accentGlow: "from-blue-500/10 to-transparent",
    },
    {
      id: 3,
      title: "Rendimiento del Sistema",
      value: "99.9%",
      change: "+0.4%",
      description: "tiempo de actividad (Uptime)",
      icon: Activity,
      iconBg: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
      accentGlow: "from-indigo-500/10 to-transparent",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Bienvenido al panel principal de tu aplicación.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></span>
            Sistema en línea
          </span>
        </div>
      </div>

      {/* Cards Grid - Exactly 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={`relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800 p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 group`}
            >
              {/* Card top subtle gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accentGlow} opacity-50 group-hover:opacity-100 transition-opacity`} />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-400">{card.title}</span>
                  <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-3xl font-extrabold text-white tracking-tight">
                    {card.value}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-800/60">
                  <div className="flex items-center text-xs font-semibold text-emerald-400">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    {card.change}
                  </div>
                  <span className="text-xs text-slate-500">{card.description}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
