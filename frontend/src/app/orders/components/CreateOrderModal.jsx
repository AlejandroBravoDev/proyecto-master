import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Utensils,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChefHat,
  Box,
  ShoppingCart
} from 'lucide-react';
import { fetchProductsForOrders, fetchCategoriesForOrders } from '../services/orderService';
import { formatCurrency } from '../utils/orderUtils';

export default function CreateOrderModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart / Order items state: [{ product, quantity, notes }]
  const [cart, setCart] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setCart([]);
      setOrderNotes('');
      setActiveCategory('all');
      setSearchTerm('');

      setLoadingMenu(true);
      Promise.all([fetchProductsForOrders(), fetchCategoriesForOrders()])
        .then(([prodData, catData]) => {
          setProducts(Array.isArray(prodData) ? prodData : []);
          setCategories(Array.isArray(catData) ? catData : []);
          setLoadingMenu(false);
        })
        .catch((err) => {
          setError(err.message || 'No se pudieron cargar los productos para la comanda.');
          setLoadingMenu(false);
        });
    }
  }, [isOpen]);

  // Filtered menu products (unconditional hook)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeCategory !== 'all' && String(p.categoryId) !== String(activeCategory)) {
        return false;
      }

      return true;
    });
  }, [products, searchTerm, activeCategory]);

  // Cart total (unconditional hook)
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0);
  }, [cart]);

  // Total items count (unconditional hook)
  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Add product to cart or increment
  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      } else {
        return [...prev, { product, quantity: 1, notes: '' }];
      }
    });
  };

  // Decrement or remove
  const handleDecrement = (productId) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      } else {
        return prev.filter((item) => item.product.id !== productId);
      }
    });
  };

  // Remove completely
  const handleRemove = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Update item notes
  const handleItemNotesChange = (productId, notes) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, notes } : item))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Debes añadir al menos un producto a la comanda.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        notes: orderNotes.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.salePrice,
          notes: item.notes.trim() || undefined,
        })),
      };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al procesar la comanda.');
    } finally {
      setSaving(false);
    }
  };

  // Guard condition after ALL hooks are declared
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Nueva Comanda / Punto de Pedido</h2>
              <p className="text-xs text-slate-400">
                Selecciona productos del menú y envía la orden a cocina
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

        {/* Modal Body: Split into Menu Catalog (Left) and Cart Summary (Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Menu Selector (7 cols) */}
          <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col space-y-4 overflow-y-auto">
            {/* Search & Category Pills */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar producto por nombre..."
                  className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Category tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === 'all'
                      ? 'bg-[#584235] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      String(activeCategory) === String(cat.id)
                        ? 'bg-[#E63946] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {loadingMenu ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No se encontraron productos disponibles en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[50vh] pr-1">
                {filteredProducts.map((p) => {
                  const cartItem = cart.find((item) => item.product.id === p.id);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer hover:shadow-md hover:border-[#E63946] relative overflow-hidden group ${
                        cartItem
                          ? 'border-[#E63946] bg-red-50/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      {/* Quantity badge if in cart */}
                      {cartItem && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#E63946] text-white text-[10px] font-black">
                          {cartItem.quantity}
                        </span>
                      )}

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block truncate">
                          {p.category?.name || 'Menú'}
                        </span>
                        <h4 className="text-xs font-bold text-[#584235] line-clamp-2 mt-0.5 group-hover:text-[#E63946] transition-colors">
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#584235]">
                          {formatCurrency(p.salePrice)}
                        </span>
                        <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-[#E63946] group-hover:text-white text-slate-600 flex items-center justify-center transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Order / Cart Details (5 cols) */}
          <div className="lg:col-span-5 p-5 bg-[#F8F9FA] flex flex-col justify-between space-y-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-4 h-4 text-[#E63946]" />
                  <h3 className="text-sm font-bold text-[#584235]">Detalle de la Comanda</h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {totalItemsCount} ítem{totalItemsCount !== 1 ? 's' : ''}
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Cart List */}
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-1">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-[#584235]">Comanda vacía</p>
                  <p className="text-[11px]">Haz clic en los productos de la izquierda para agregarlos.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[35vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#584235] leading-tight">
                            {item.product.name}
                          </p>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {formatCurrency(item.product.salePrice)} c/u
                          </span>
                        </div>

                        <span className="text-xs font-extrabold text-[#584235]">
                          {formatCurrency(item.product.salePrice * item.quantity)}
                        </span>
                      </div>

                      {/* Line notes input */}
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemNotesChange(item.product.id, e.target.value)}
                        placeholder="Nota de cocina (ej: Sin salsa, Bien cocido)..."
                        className="w-full px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946]"
                      />

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleRemove(item.product.id)}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Quitar</span>
                        </button>

                        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.product.id)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-[#584235] w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item.product)}
                            className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Notes / Table Info */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Identificador / Mesa / Notas de Comanda
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Ej: Mesa 3, Para llevar, Barra #2..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] font-medium"
                />
              </div>
            </div>

            {/* Total and Submit Action */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total a Pagar
                </span>
                <span className="text-2xl font-black text-[#584235]">
                  {formatCurrency(cartTotal)}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || cart.length === 0}
                  className="flex-2 flex items-center justify-center space-x-2 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  <span>{saving ? 'Registrando comanda...' : 'Despachar a Cocina'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
