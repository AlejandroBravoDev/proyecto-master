import React, { useState, useEffect } from 'react';
import { X, Save, Box } from 'lucide-react';
import { MEASUREMENT_UNITS } from '../utils/inventoryUtils';

export default function IngredientModal({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
}) {
  const isEditing = Boolean(initialData);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    measurementUnit: 'unidad',
    currentStock: 0,
    minimumStock: 5,
    unitCost: 0,
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        measurementUnit: initialData.measurementUnit || 'unidad',
        currentStock: initialData.currentStock ?? 0,
        minimumStock: initialData.minimumStock ?? 5,
        unitCost: initialData.unitCost ?? 0,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        measurementUnit: 'unidad',
        currentStock: 0,
        minimumStock: 5,
        unitCost: 0,
      });
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre del insumo es obligatorio.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        ...formData,
        currentStock: Number(formData.currentStock) || 0,
        minimumStock: Number(formData.minimumStock) || 0,
        unitCost: Number(formData.unitCost) || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Ocurrió un error al guardar el insumo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#E63946]/10 text-[#E63946] flex items-center justify-center">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                {isEditing ? 'Editar Insumo' : 'Nuevo Insumo'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Modifica los datos del insumo en catálogo' : 'Registra una materia prima en el inventario'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946]">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-[#584235] mb-1">
              Nombre del Insumo <span className="text-[#E63946]">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej. Carne de Res 150g, Pan Brioche, Queso Cheddar"
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#584235] mb-1">
              Descripción / Presentación
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ej. Paquete x 10 unidades, Presentación en bolsa"
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white"
            />
          </div>

          {/* Measurement Unit & Unit Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#584235] mb-1">
                Unidad de Medida <span className="text-[#E63946]">*</span>
              </label>
              <select
                value={formData.measurementUnit}
                onChange={(e) => setFormData({ ...formData, measurementUnit: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white font-medium"
              >
                {MEASUREMENT_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#584235] mb-1">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white"
              />
            </div>
          </div>

          {/* Stocks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#584235] mb-1">
                {isEditing ? 'Stock Actual' : 'Stock Inicial'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={isEditing}
                value={formData.currentStock}
                onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none ${
                  isEditing
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-[#F8F9FA] border-slate-200 text-[#584235] focus:border-[#E63946] focus:bg-white'
                }`}
              />
              {isEditing && (
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Usa "Ajustar Stock" para movimientos de Kardex.
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#584235] mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.minimumStock}
                onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Guardando...' : isEditing ? 'Actualizar Insumo' : 'Crear Insumo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
