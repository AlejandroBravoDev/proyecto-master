import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Banknote,
  CreditCard,
  Send,
  Wallet,
  Receipt
} from 'lucide-react';
import { fetchProductsForSale } from '../services/cajaService';
import { formatCurrency, PAYMENT_METHODS } from '../utils/cajaUtils';

export default function DirectSaleModal({
  isOpen,
  onClose,
  onSubmit,
}) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Cart: [{ product, quantity }]
  const [cart, setCart] = useState([]);

  // Payment configuration
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setCart([]);
      setPaymentMethod('CASH');
      setCashReceived('');
      setDiscount('');
      setTax('');
      setSearchTerm('');

      setLoadingProducts(true);
      fetchProductsForSale()
        .then((data) => {
          setProducts(Array.isArray(data) ? data : []);
          setLoadingProducts(false);
        })
        .catch((err) => {
          setError(err.message || 'No se pudieron cargar los productos.');
          setLoadingProducts(false);
        });
    }
  }, [isOpen]);

  // Calculations (unconditional hooks)
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0);
  }, [cart]);

  const taxAmount = Number(tax) || 0;
  const discountAmount = Number(discount) || 0;
  const finalTotal = Math.max(0, subtotal + taxAmount - discountAmount);

  const cashReceivedNum = Number(cashReceived) || 0;
  const changeDue = Math.max(0, cashReceivedNum - finalTotal);

  // Cart operations
  const handleAddToCart = (product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleDecrement = (productId) => {
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (item && item.quantity > 1) {
        return prev.map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.product.id !== productId);
    });
  };

  const handleRemove = (productId) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (cart.length === 0) {
      setError('Debes agregar al menos un producto a la venta.');
      return;
    }

    if (paymentMethod === 'CASH' && cashReceivedNum > 0 && cashReceivedNum < finalTotal) {
      setError(`El efectivo recibido (${formatCurrency(cashReceivedNum)}) es menor al total a cobrar (${formatCurrency(finalTotal)}).`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        paymentMethod,
        tax: taxAmount,
        discount: discountAmount,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.salePrice,
        })),
      };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al procesar el cobro.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">Cobro Directo en Caja</h2>
              <p className="text-xs text-slate-400">Venta inmediata y emisión de factura fiscal</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Split Layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* Left Column: Product Selection */}
          <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col space-y-4 overflow-y-auto">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar producto para cobrar..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-[#F8F9FA] border border-slate-200 text-xs text-[#584235] placeholder:text-slate-400 focus:outline-none focus:border-[#E63946] focus:bg-white transition-all font-medium"
              />
            </div>

            {/* Products Grid */}
            {loadingProducts ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-20 rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No se encontraron productos disponibles.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[50vh] pr-1">
                {filteredProducts.map((p) => {
                  const inCart = cart.find((i) => i.product.id === p.id);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer hover:shadow-md hover:border-[#E63946] relative overflow-hidden group ${
                        inCart
                          ? 'border-[#E63946] bg-red-50/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      {inCart && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-[#E63946] text-white text-[10px] font-black">
                          {inCart.quantity}
                        </span>
                      )}

                      <h4 className="text-xs font-bold text-[#584235] line-clamp-2">
                        {p.name}
                      </h4>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#584235]">
                          {formatCurrency(p.salePrice)}
                        </span>
                        <div className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-[#E63946] group-hover:text-white text-slate-600 flex items-center justify-center transition-colors">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Checkout Details */}
          <div className="lg:col-span-5 p-5 bg-[#F8F9FA] flex flex-col justify-between space-y-4 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#584235] border-b border-slate-200 pb-2">
                Resumen de Venta
              </h3>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-[#E63946] flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Cart List */}
              {cart.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Selecciona productos para cobrar.
                </div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-[#584235] truncate">{item.product.name}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatCurrency(item.product.salePrice)} c/u
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.product.id)}
                            className="w-5 h-5 rounded bg-white flex items-center justify-center text-slate-700"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-xs font-bold text-[#584235] w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item.product)}
                            className="w-5 h-5 rounded bg-white flex items-center justify-center text-slate-700"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <span className="font-extrabold text-[#584235] w-14 text-right">
                          {formatCurrency(item.product.salePrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Method Selector */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Forma de Pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CARD')}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'CARD'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'TRANSFER'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Transferencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MIXED')}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'MIXED'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Mixto</span>
                  </button>
                </div>
              </div>

              {/* Cash Change Calculator (If CASH) */}
              {paymentMethod === 'CASH' && (
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-emerald-800 uppercase">
                      Efectivo Recibido:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="w-28 px-3 py-1 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-[#584235] text-right focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  {cashReceivedNum > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-200/80 font-bold">
                      <span className="text-emerald-800">Cambio a Entregar:</span>
                      <span className="text-sm font-black text-emerald-900">
                        {formatCurrency(changeDue)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total and Checkout Action */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Cobrado
                </span>
                <span className="text-2xl font-black text-[#584235]">
                  {formatCurrency(finalTotal)}
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
                  <span>{saving ? 'Emitiendo Factura...' : 'Completar Cobro'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
