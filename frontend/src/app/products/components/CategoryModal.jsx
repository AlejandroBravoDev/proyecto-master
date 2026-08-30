import React, { useState } from 'react';
import { X, Plus, Trash2, FolderPlus, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { createCategory, deleteCategory } from '../services/productService';

export default function CategoryModal({
  isOpen,
  onClose,
  categories = [],
  onCategoriesChanged,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre de la categoría es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      await createCategory({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      onCategoriesChanged();
    } catch (err) {
      setError(err.message || 'Error al crear la categoría.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (window.confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"?`)) {
      try {
        await deleteCategory(cat.id);
        onCategoriesChanged();
      } catch (err) {
        setError(err.message || 'No se pudo eliminar la categoría.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Gestión de Categorías</h2>
              <p className="text-xs text-slate-400">Organiza los productos de tu carta o menú</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* New Category Form */}
          <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-[#F8F9FA] border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Nueva Categoría
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre (ej: Hamburguesas, Bebidas, Postres)"
                className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946]"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional"
                className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{saving ? 'Guardando...' : 'Agregar Categoría'}</span>
              </button>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Categorías Registradas ({categories.length})
            </h3>
            {categories.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">No hay categorías registradas.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-bold text-[#584235]">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-slate-400">{cat.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
