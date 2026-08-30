import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChefHat, Box, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchIngredientsForRecipe } from '../services/productService';

export default function ProductModal({
  isOpen,
  onClose,
  onSubmit,
  categories = [],
  initialData = null,
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [description, setDescription] = useState('');
  const [productType, setProductType] = useState('PREPARED');
  const [available, setAvailable] = useState(true);

  // Dynamic Recipe Ingredients
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [warehouseIngredients, setWarehouseIngredients] = useState([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(initialData);

  // Populate or reset form on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      if (initialData) {
        setName(initialData.name || '');
        setCategoryId(initialData.categoryId ? String(initialData.categoryId) : '');
        setSalePrice(initialData.salePrice !== undefined ? String(initialData.salePrice) : '');
        setDescription(initialData.description || '');
        setProductType(initialData.productType || 'PREPARED');
        setAvailable(initialData.available !== undefined ? Boolean(initialData.available) : true);

        // Pre-fill existing recipe ingredients if any
        if (initialData.recipe && initialData.recipe.recipeDetails) {
          setRecipeIngredients(
            initialData.recipe.recipeDetails.map((rd) => ({
              ingredientId: rd.ingredientId,
              quantity: rd.quantity,
              measurementUnit: rd.measurementUnit || rd.ingredient?.measurementUnit || '',
            }))
          );
        } else {
          setRecipeIngredients([]);
        }
      } else {
        setName('');
        setCategoryId(categories.length > 0 ? String(categories[0].id) : '');
        setSalePrice('');
        setDescription('');
        setProductType('PREPARED');
        setAvailable(true);
        setRecipeIngredients([]);
      }

      // Fetch warehouse ingredients for recipe options
      setLoadingIngredients(true);
      fetchIngredientsForRecipe()
        .then((data) => {
          setWarehouseIngredients(Array.isArray(data) ? data : []);
          setLoadingIngredients(false);
        })
        .catch(() => {
          setWarehouseIngredients([]);
          setLoadingIngredients(false);
        });
    }
  }, [isOpen, initialData, categories]);

  if (!isOpen) return null;

  const handleAddRecipeRow = () => {
    if (warehouseIngredients.length === 0) return;
    const firstIng = warehouseIngredients[0];
    setRecipeIngredients((prev) => [
      ...prev,
      {
        ingredientId: firstIng.id,
        quantity: 1,
        measurementUnit: firstIng.measurementUnit || 'unidad',
      },
    ]);
  };

  const handleRemoveRecipeRow = (index) => {
    setRecipeIngredients((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleIngredientChange = (index, ingId) => {
    const selected = warehouseIngredients.find((i) => String(i.id) === String(ingId));
    setRecipeIngredients((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ingredientId: Number(ingId),
        measurementUnit: selected ? selected.measurementUnit : updated[index].measurementUnit,
      };
      return updated;
    });
  };

  const handleQuantityChange = (index, qty) => {
    setRecipeIngredients((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: Number(qty) || 0,
      };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }

    if (!categoryId) {
      setError('Debes seleccionar una categoría.');
      return;
    }

    const priceNum = Number(salePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('El precio de venta debe ser un número mayor o igual a 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        categoryId: Number(categoryId),
        name: name.trim(),
        description: description.trim() || undefined,
        salePrice: priceNum,
        productType,
        available,
      };

      if (!isEditing && productType === 'PREPARED' && recipeIngredients.length > 0) {
        payload.recipe = {
          name: `Receta de ${name.trim()}`,
          ingredients: recipeIngredients.map((item) => ({
            ingredientId: Number(item.ingredientId),
            quantity: Number(item.quantity),
            measurementUnit: String(item.measurementUnit),
          })),
        };
      }

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              {productType === 'PREPARED' ? <ChefHat className="w-5 h-5" /> : <Box className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                {isEditing ? `Editar Producto: ${initialData.name}` : 'Crear Nuevo Producto'}
              </h2>
              <p className="text-xs text-slate-400">
                Configura precios, categoría y receta para el menú de ventas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Tipo de Producto
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProductType('PREPARED')}
                className={`flex items-center justify-center space-x-2 p-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  productType === 'PREPARED'
                    ? 'border-[#FF7A00] bg-orange-50/60 text-[#FF7A00] shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>Preparado (con Receta)</span>
              </button>

              <button
                type="button"
                onClick={() => setProductType('DIRECT_INVENTORY')}
                className={`flex items-center justify-center space-x-2 p-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  productType === 'DIRECT_INVENTORY'
                    ? 'border-blue-500 bg-blue-50/60 text-blue-600 shadow-sm'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Box className="w-4 h-4" />
                <span>Venta Directa</span>
              </button>
            </div>
          </div>

          {/* Name & Category Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Nombre del Producto *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Hamburguesa con Queso"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Categoría *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium cursor-pointer"
              >
                <option value="" disabled>Selecciona una categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Availability Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Precio de Venta ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="Ej: 7.50"
                className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Disponibilidad Inmediata
              </label>
              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="productAvailable"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="w-5 h-5 rounded-lg text-[#E63946] focus:ring-[#E63946] border-slate-300 cursor-pointer"
                />
                <label htmlFor="productAvailable" className="text-sm font-semibold text-[#584235] cursor-pointer">
                  Disponible para venta en caja/comandas
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Descripción Opcional
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre ingredientes, preparación o presentación..."
              className="w-full px-4 py-2.5 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-sm text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium resize-none"
            />
          </div>

          {/* Recipe Ingredients Configuration (If Prepared) */}
          {productType === 'PREPARED' && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Receta e Insumos a Descontar de Bodega
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Define la cantidad de insumos que se descontarán automáticamente del Kardex por cada venta
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRecipeRow}
                  disabled={warehouseIngredients.length === 0}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-orange-50 text-[#FF7A00] hover:bg-orange-100 text-xs font-bold transition-colors cursor-pointer border border-orange-200 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Insumo</span>
                </button>
              </div>

              {loadingIngredients ? (
                <div className="p-4 text-center text-xs text-slate-400 animate-pulse">
                  Cargando catálogo de materias primas...
                </div>
              ) : recipeIngredients.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-dashed border-slate-300 text-center text-xs text-slate-400">
                  No se han agregado insumos a la receta de este producto.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {recipeIngredients.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200"
                    >
                      {/* Ingredient Dropdown */}
                      <select
                        value={item.ingredientId}
                        onChange={(e) => handleIngredientChange(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-[#584235] focus:outline-none focus:border-[#FF7A00]"
                      >
                        {warehouseIngredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.measurementUnit})
                          </option>
                        ))}
                      </select>

                      {/* Quantity Input */}
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        required
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        placeholder="Cantidad"
                        className="w-24 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-[#584235] focus:outline-none focus:border-[#FF7A00]"
                      />

                      {/* Measurement Unit Tag */}
                      <span className="text-xs font-semibold text-slate-400 w-14 text-center truncate">
                        {item.measurementUnit}
                      </span>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Quitar insumo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Guardando...' : isEditing ? 'Actualizar Producto' : 'Crear Producto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
