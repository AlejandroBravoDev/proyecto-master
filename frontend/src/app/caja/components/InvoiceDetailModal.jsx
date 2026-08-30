import React from 'react';
import { X, Receipt, Printer, Utensils, CheckCircle2, Banknote } from 'lucide-react';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '../utils/cajaUtils';

export default function InvoiceDetailModal({
  isOpen,
  onClose,
  sale = null,
}) {
  if (!isOpen || !sale) return null;

  const methodConfig = PAYMENT_METHODS[sale.paymentMethod] || PAYMENT_METHODS.CASH;
  const saleDetails = sale.saleDetails || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#E63946] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#584235]">
                Comprobante de Pago Fiscal
              </h2>
              <p className="text-xs text-slate-400">Factura oficial emitida por el sistema</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Ticket Receipt Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white" id="printable-invoice">
          {/* Business Banner */}
          <div className="text-center pb-4 border-b border-dashed border-slate-200 space-y-1">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-[#E63946] flex items-center justify-center text-white text-xs font-black">
                <Utensils className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-[#584235] tracking-wide">
                Master<span className="text-[#E63946]">Food</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Sistema de Facturación POS</p>
            <p className="text-xs font-extrabold text-[#584235] pt-1">{sale.invoiceNumber}</p>
            <p className="text-[11px] text-slate-400">{formatDateTime(sale.createdAt || sale.fecha)}</p>
          </div>

          {/* Payment Method Badge */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-xs font-bold text-slate-500">Método de Pago</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${methodConfig.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${methodConfig.dotClass}`} />
              {methodConfig.label}
            </span>
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Detalle de Productos Facturados
            </span>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {saleDetails.map((detail) => (
                <div key={detail.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#584235]">
                      <span className="text-[#E63946] mr-1">{detail.quantity}x</span>
                      {detail.product?.name || `Producto #${detail.productId}`}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      {formatCurrency(detail.unitPrice)} c/u
                    </span>
                  </div>
                  <span className="font-extrabold text-[#584235]">
                    {formatCurrency(detail.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">{formatCurrency(sale.subtotal)}</span>
            </div>

            {sale.tax > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Impuestos / IVA:</span>
                <span className="font-mono font-semibold">+{formatCurrency(sale.tax)}</span>
              </div>
            )}

            {sale.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Descuento Aplicado:</span>
                <span className="font-mono">-{formatCurrency(sale.discount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-[#584235]">
              <span>TOTAL COBRADO:</span>
              <span className="text-xl text-[#E63946]">{formatCurrency(sale.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Imprimir Ticket</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-500/20 transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
