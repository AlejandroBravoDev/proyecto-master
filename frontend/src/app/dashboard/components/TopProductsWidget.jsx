import React from 'react';
import { ShoppingBag } from 'lucide-react';

export default function TopProductsWidget({ products = [] }) {
  const hasProducts = Array.isArray(products) && products.length > 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between min-h-[280px]">
      <h2 className="text-lg font-bold text-[#584235] mb-4">Productos más vendidos</h2>

      {!hasProducts ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-[#584235]">No hay productos registrados ahora</p>
          <p className="text-xs text-slate-400 mt-1">Aún no se ha registrado ninguna venta en el sistema.</p>
        </div>
      ) : (
        <div className="space-y-4 flex-1 flex flex-col justify-around">
          {products.map((item, index) => {
            const rank = index + 1;
            const isTop = rank === 1;

            return (
              <div
                key={item.id || index}
                className="flex items-center space-x-4 p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                {/* Rank badge */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${
                    isTop
                      ? 'bg-[#E63946] text-white shadow-red-200'
                      : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {rank}
                </div>

                {/* Product details */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#584235] text-base leading-snug truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    {item.totalSold} {item.totalSold === 1 ? 'vendido' : 'vendidos'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
