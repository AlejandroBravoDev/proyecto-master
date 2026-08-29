import React from 'react';
import { SlidersHorizontal, History, Edit3, Trash2, Box, AlertCircle } from 'lucide-react';
import { formatCurrency, formatQuantity, getStockStatus } from '../utils/inventoryUtils';

export default function IngredientTable({
  ingredients = [],
  onAdjustStock,
  onViewKardex,
  onEdit,
  onDelete,
}) {
  if (!ingredients || ingredients.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center flex flex-col items-center justify-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <Box className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-[#584235]">No se encontraron insumos</h3>
        <p className="text-xs text-slate-400 max-w-sm">
          No hay materias primas que coincidan con los filtros aplicados o aún no has registrado ningún insumo.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-4 px-6">Insumo</th>
              <th className="py-4 px-4">Unidad</th>
              <th className="py-4 px-4 text-right">Stock Actual</th>
              <th className="py-4 px-4 text-right">Stock Mínimo</th>
              <th className="py-4 px-4 text-right">Costo Unitario</th>
              <th className="py-4 px-4 text-center">Estado</th>
              <th className="py-4 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm font-medium text-[#584235]">
            {ingredients.map((item) => {
              const statusInfo = getStockStatus(item.currentStock, item.minimumStock);

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  {/* Name & Description */}
                  <td className="py-4 px-6">
                    <div className="font-bold text-base text-[#584235]">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-slate-400 truncate max-w-xs">{item.description}</div>
                    )}
                  </td>

                  {/* Measurement Unit */}
                  <td className="py-4 px-4 text-slate-500 font-semibold">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs">
                      {item.measurementUnit}
                    </span>
                  </td>

                  {/* Current Stock */}
                  <td className="py-4 px-4 text-right font-bold text-base">
                    <span className={statusInfo.isCritical ? 'text-[#E63946]' : 'text-[#584235]'}>
                      {formatQuantity(item.currentStock, item.measurementUnit)}
                    </span>
                  </td>

                  {/* Minimum Stock */}
                  <td className="py-4 px-4 text-right text-slate-400">
                    {formatQuantity(item.minimumStock, item.measurementUnit)}
                  </td>

                  {/* Unit Cost */}
                  <td className="py-4 px-4 text-right font-semibold text-slate-600">
                    {formatCurrency(item.unitCost)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                    >
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {/* Adjust Stock */}
                      <button
                        onClick={() => onAdjustStock(item)}
                        title="Ajustar Stock (Kardex)"
                        className="p-2 rounded-xl text-slate-400 hover:text-[#FF7A00] hover:bg-orange-50 transition-colors cursor-pointer"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>

                      {/* View Kardex */}
                      <button
                        onClick={() => onViewKardex(item)}
                        title="Ver Movimientos de Kardex"
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => onEdit(item)}
                        title="Editar Insumo"
                        className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onDelete(item)}
                        title="Eliminar Insumo"
                        className="p-2 rounded-xl text-slate-400 hover:text-[#E63946] hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
