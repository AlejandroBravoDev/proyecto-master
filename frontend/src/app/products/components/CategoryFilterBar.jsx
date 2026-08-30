import React from 'react';
import { Layers } from 'lucide-react';

export default function CategoryFilterBar({
  categories = [],
  activeCategory = 'all',
  onSelectCategory,
  productCounts = {},
}) {
  const totalProducts = Object.values(productCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center justify-center overflow-x-auto py-1">
      <div className="bg-slate-200/60 p-1.5 rounded-2xl flex items-center space-x-1 border border-slate-200 shadow-sm">
        {/* 'All' Tab */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
              : 'text-slate-500 hover:text-[#584235]'
          }`}
        >
          <Layers className={`w-3.5 h-3.5 ${activeCategory === 'all' ? 'text-[#E63946]' : 'text-slate-400'}`} />
          <span>Todas las Categorías</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-extrabold">
            {totalProducts}
          </span>
        </button>

        {/* Dynamic Category Tabs */}
        {categories.map((cat) => {
          const isActive = String(activeCategory) === String(cat.id);
          const count = productCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-[#584235] shadow-md shadow-slate-300/50'
                  : 'text-slate-500 hover:text-[#584235]'
              }`}
            >
              <span>{cat.name}</span>
              {count > 0 && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive ? 'bg-[#E63946] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
