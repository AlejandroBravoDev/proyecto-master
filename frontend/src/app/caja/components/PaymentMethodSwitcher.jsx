import React from 'react';
import { Layers, Banknote, CreditCard, Send, Wallet } from 'lucide-react';

export default function PaymentMethodSwitcher({
  activeMethod = 'all',
  onSelectMethod,
  counts = {},
}) {
  const tabs = [
    { id: 'all', label: 'Todas las Ventas', icon: Layers, count: counts.all || 0 },
    { id: 'CASH', label: 'Efectivo', icon: Banknote, count: counts.CASH || 0 },
    { id: 'CARD', label: 'Tarjeta', icon: CreditCard, count: counts.CARD || 0 },
    { id: 'TRANSFER', label: 'Transferencia', icon: Send, count: counts.TRANSFER || 0 },
    { id: 'MIXED', label: 'Mixto', icon: Wallet, count: counts.MIXED || 0 },
  ];

  return (
    <div className="flex items-center justify-center overflow-x-auto py-1">
      <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-200 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMethod === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectMethod(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
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
                    isActive ? 'bg-[#E63946] text-white' : 'bg-slate-100 text-slate-600'
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
