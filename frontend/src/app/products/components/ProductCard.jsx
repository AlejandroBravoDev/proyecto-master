import React, { useState } from 'react';
import { Edit2, Trash2, Utensils, Box, ChefHat, Check, X } from 'lucide-react';
import { formatCurrency, PRODUCT_TYPES } from '../utils/productUtils';

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggleAvailability,
}) {
  const [toggling, setToggling] = useState(false);

  const isPrepared = product.productType === 'PREPARED';
  const typeConfig = PRODUCT_TYPES[product.productType] || PRODUCT_TYPES.PREPARED;
  const isAvailable = Boolean(product.available);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    try {
      await onToggleAvailability(product.id, !isAvailable);
    } finally {
      setToggling(false);
    }
  };

  const recipeDetails = product.recipe?.recipeDetails || [];

  return (
    <div
      className={`bg-white rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 relative overflow-hidden ${
        isAvailable ? 'border-slate-200/80 shadow-sm' : 'border-slate-200/50 bg-slate-50/40 opacity-80'
      }`}
    >
      {/* Top Accent Strip */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isAvailable ? 'bg-[#E63946]' : 'bg-slate-300'}`} />

      {/* Card Header: Category & Type Badges */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Category Badge */}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-[#584235] border border-slate-200">
            {product.category?.name || 'Sin Categoría'}
          </span>

          {/* Product Type Badge */}
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${typeConfig.badgeClass}`}
          >
            {isPrepared ? (
              <ChefHat className="w-3 h-3 mr-1" />
            ) : (
              <Box className="w-3 h-3 mr-1" />
            )}
            {typeConfig.shortLabel}
          </span>
        </div>

        {/* Product Title & Description */}
        <div>
          <h3 className="text-lg font-bold text-[#584235] leading-tight line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[2rem]">
            {product.description || 'Sin descripción detallada para este producto.'}
          </p>
        </div>

        {/* Recipe Summary info if prepared */}
        {isPrepared && (
          <div className="pt-1">
            <span className="inline-flex items-center text-[11px] text-slate-500 font-medium bg-[#F8F9FA] px-2.5 py-1 rounded-xl border border-slate-200/60">
              <Utensils className="w-3 h-3 mr-1.5 text-[#FF7A00]" />
              {recipeDetails.length > 0
                ? `${recipeDetails.length} ingrediente${recipeDetails.length > 1 ? 's' : ''} en receta`
                : 'Receta sin insumos'}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer: Price & Actions */}
      <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
        {/* Price */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Precio</span>
          <span className="text-xl font-extrabold text-[#584235]">
            {formatCurrency(product.salePrice)}
          </span>
        </div>

        {/* Right Action Icons & Availability Toggle */}
        <div className="flex items-center space-x-2">
          {/* Availability Toggle Pill */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={isAvailable ? 'Marcar como No Disponible' : 'Marcar como Disponible'}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isAvailable
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {isAvailable ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="hidden sm:inline">Disponible</span>
              </>
            ) : (
              <>
                <X className="w-3 h-3 text-slate-400" />
                <span className="hidden sm:inline">Agotado</span>
              </>
            )}
          </button>

          {/* Edit Button */}
          <button
            onClick={() => onEdit(product)}
            title="Editar producto"
            className="p-2 rounded-xl text-slate-400 hover:text-[#584235] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(product)}
            title="Eliminar producto"
            className="p-2 rounded-xl text-slate-400 hover:text-[#E63946] hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
