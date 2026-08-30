import React from 'react';
import { Eye, Trash2, Clock, FileText } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/orderUtils';

export default function OrderCard({
  order,
  onViewDetail,
  onDelete,
}) {
  const orderDetails = order.orderDetails || [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm transition-all duration-300 p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 relative overflow-hidden">
      {/* Top Accent Strip */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E63946]" />

      <div className="space-y-4">
        {/* Ticket Top Info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-black text-[#584235] tracking-tight">
              {order.number}
            </span>
          </div>

          <div className="text-xs text-slate-400 font-medium flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDateTime(order.createdAt)}</span>
          </div>
        </div>

        {/* Order Notes / Table */}
        {order.notes && (
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-[#584235] font-medium flex items-start space-x-2">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{order.notes}</span>
          </div>
        )}

        {/* Items Breakdown Preview */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Ítems del Pedido ({orderDetails.length})
          </span>
          <ul className="space-y-1 text-xs text-[#584235] max-h-32 overflow-y-auto pr-1">
            {orderDetails.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="truncate pr-2">
                  <strong className="text-[#E63946] mr-1">{item.quantity}x</strong>
                  {item.product?.name || `Producto #${item.productId}`}
                </span>
                <span className="font-semibold text-slate-500 shrink-0">
                  {formatCurrency(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer: Grand Total & Actions */}
      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total</span>
          <span className="text-xl font-black text-[#584235]">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Detail / Ticket Button */}
          <button
            onClick={() => onViewDetail(order)}
            title="Ver ticket completo"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#584235] text-xs font-bold transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4 text-slate-600" />
            <span>Detalle</span>
          </button>

          {/* Delete / Cancel Button (Always available for error correction) */}
          <button
            onClick={() => onDelete(order)}
            title="Eliminar comanda"
            className="p-2 rounded-xl text-slate-400 hover:text-[#E63946] hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
