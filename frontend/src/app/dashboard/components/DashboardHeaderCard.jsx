import React from 'react';

const FILTER_TABS = [
  { label: 'Día', value: 'day' },
  { label: 'Mes', value: 'month' },
  { label: 'Año', value: 'year' },
];

export default function DashboardHeaderCard({
  title = "Dashboard MasterFood",
  subtitle = "Aquí podrás ver un resumen muy completo del negocio",
  activePeriod = 'day',
  onPeriodChange,
}) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-[#584235] tracking-tight">{title}</h1>
        <p className="text-slate-400 text-sm mt-1 font-medium">{subtitle}</p>
      </div>

      {/* Filter Tabs Container */}
      <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 self-start md:self-auto border border-slate-200">
        {FILTER_TABS.map((tab) => {
          const isActive = activePeriod === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => onPeriodChange && onPeriodChange(tab.value)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
                  : 'text-slate-500 hover:text-[#584235]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
