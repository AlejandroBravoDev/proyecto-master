import React from 'react';

export default function DashboardHeader({ title, description, statusText = "Sistema en línea" }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
          {statusText}
        </span>
      </div>
    </div>
  );
}
