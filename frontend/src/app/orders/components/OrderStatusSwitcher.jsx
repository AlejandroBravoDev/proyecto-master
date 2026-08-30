import React from 'react';
import { Layers, Clock, CheckCircle2 } from 'lucide-react';

export default function OrderStatusSwitcher({
  activeFilter = 'all',
  onFilterChange,
  counts = { all: 0, pending: 0, billed: 0 },
}) {
  const tabs = [
    { id: 'all', label: 'Todas las Comandas', icon: Layers, count: counts.all, color: 'text-slate-600' },
    { id: 'pending', label: 'Pendientes / Cocina', icon: Clock, count: counts.pending, color: 'text-amber-600' },
    { id: 'billed', label: 'Facturadas / Pagadas', icon: CheckCircle2, count: counts.billed, color: 'text-emerald-600' },
  ];

  return (
    <div className="flex items-center justify-center overflow-x-auto py-1">
      <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-200 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
                  : 'text-slate-500 hover:text-[#584235]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#E63946]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-[#E63946] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
