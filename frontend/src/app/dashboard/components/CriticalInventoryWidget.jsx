import React from 'react';

export default function CriticalInventoryWidget() {
  const inventoryItems = [
    { name: 'Carne de Hamburguesa', percentage: 25, isCritical: false },
    { name: 'Salchicha', percentage: 10, isCritical: true },
    { name: 'Soda', percentage: 40, isCritical: false },
    { name: 'Pan de Hamburguesa', percentage: 40, isCritical: false },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6">
      <h2 className="text-lg font-bold text-[#584235] mb-6">Estado de inventario (Crítico)</h2>

      <div className="space-y-5">
        {inventoryItems.map((item, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-[#584235]">{item.name}</span>
              <span className={item.isCritical ? 'text-[#E63946] font-extrabold' : 'text-slate-400'}>
                {item.percentage}% Restante
              </span>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  item.isCritical ? 'bg-[#E63946]' : 'bg-[#FF7A00]'
                }`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
