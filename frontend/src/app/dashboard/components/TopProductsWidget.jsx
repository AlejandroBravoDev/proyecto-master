import React from 'react';

export default function TopProductsWidget() {
  const products = [
    { rank: 1, name: 'Hamburguesa Clásica', sales: '120 vendidas', isTop: true },
    { rank: 2, name: 'Empanadas', sales: '100 vendidas', isTop: false },
    { rank: 3, name: 'Perro Caliente', sales: '80 Vendidos', isTop: false },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
      <h2 className="text-lg font-bold text-[#584235] mb-6">Productos más vendidos</h2>

      <div className="space-y-4 flex-1 flex flex-col justify-around">
        {products.map((item) => (
          <div
            key={item.rank}
            className="flex items-center space-x-4 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors"
          >
            {/* Rank badge */}
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${
                item.isTop
                  ? 'bg-[#E63946] text-white shadow-red-200'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {item.rank}
            </div>

            {/* Product details */}
            <div>
              <p className="font-bold text-[#584235] text-base leading-snug">{item.name}</p>
              <p className="text-xs text-slate-400 font-medium">{item.sales}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
