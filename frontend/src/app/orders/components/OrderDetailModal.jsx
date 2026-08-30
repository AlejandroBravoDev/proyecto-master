import React from 'react';
import { X, FileText, Receipt } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/orderUtils';

export default function OrderDetailModal({
  isOpen,
  onClose,
  order = null,
}) {
  if (!isOpen || !order) return null;

  const orderDetails = order.orderDetails || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                Ticket de Comanda: {order.number}
              </h2>
              <p className="text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 font-sans">
          {/* Mesa / Notas Info */}
          {order.notes && (
            <div className="p-3.5 rounded-2xl bg-[#F8F9FA] border border-slate-200/80">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Ubicación / Notas</span>
              <span className="text-xs font-bold text-[#584235]">{order.notes}</span>
            </div>
          )}

          {/* Items Breakdown Table */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Productos Solicitados ({orderDetails.length})
            </span>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {orderDetails.map((item) => (
                <div key={item.id} className="p-3 bg-white flex flex-col space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-[#E63946] bg-red-50 px-2 py-0.5 rounded-md">
                        {item.quantity}x
                      </span>
                      <span className="font-bold text-[#584235]">
                        {item.product?.name || `Producto #${item.productId}`}
                      </span>
                    </div>
                    <span className="font-extrabold text-[#584235]">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>

                  {/* Notes if any */}
                  {item.notes && (
                    <p className="text-[11px] text-amber-600 bg-amber-50/60 px-2 py-0.5 rounded-md font-medium inline-block self-start">
                      Nota: {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Grand Total */}
          <div className="p-4 rounded-2xl bg-[#584235] text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-300 uppercase block">Total de la Orden</span>
              <span className="text-2xl font-black">{formatCurrency(order.total)}</span>
            </div>
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold">
              {orderDetails.reduce((acc, i) => acc + i.quantity, 0)} artículos
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
