import React from 'react';
import { Receipt, Eye, Banknote, CreditCard, Send, Wallet, Clock } from 'lucide-react';
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from '../utils/cajaUtils';

export default function SaleTable({
  sales = [],
  onViewInvoice,
}) {
  const getMethodIcon = (methodKey) => {
    switch (methodKey) {
      case 'CASH':
        return <Banknote className="w-3.5 h-3.5 mr-1" />;
      case 'CARD':
        return <CreditCard className="w-3.5 h-3.5 mr-1" />;
      case 'TRANSFER':
        return <Send className="w-3.5 h-3.5 mr-1" />;
      case 'MIXED':
        return <Wallet className="w-3.5 h-3.5 mr-1" />;
      default:
        return <Banknote className="w-3.5 h-3.5 mr-1" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
              <th className="py-4 px-6">Comprobante / Factura</th>
              <th className="py-4 px-6">Fecha y Hora</th>
              <th className="py-4 px-6">Forma de Pago</th>
              <th className="py-4 px-6 text-center">Ítems</th>
              <th className="py-4 px-6 text-right">Subtotal</th>
              <th className="py-4 px-6 text-right">Total Cobrado</th>
              <th className="py-4 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#584235]">
            {sales.map((sale) => {
              const methodConfig = PAYMENT_METHODS[sale.paymentMethod] || PAYMENT_METHODS.CASH;
              const saleDetails = sale.saleDetails || [];
              const totalItems = saleDetails.reduce((acc, i) => acc + i.quantity, 0);

              return (
                <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Invoice Number */}
                  <td className="py-4 px-6 font-extrabold text-sm text-[#584235]">
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-[#E63946]" />
                      <span>{sale.invoiceNumber}</span>
                    </div>
                  </td>

                  {/* Date & Time */}
                  <td className="py-4 px-6 text-slate-500 whitespace-nowrap">
                    {formatDateTime(sale.createdAt || sale.fecha)}
                  </td>

                  {/* Payment Method Badge */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${methodConfig.badgeClass}`}
                    >
                      {getMethodIcon(sale.paymentMethod)}
                      {methodConfig.label}
                    </span>
                  </td>

                  {/* Items count */}
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                      {totalItems} und
                    </span>
                  </td>

                  {/* Subtotal */}
                  <td className="py-4 px-6 text-right text-slate-400 font-mono font-semibold">
                    {formatCurrency(sale.subtotal)}
                  </td>

                  {/* Total */}
                  <td className="py-4 px-6 text-right font-black text-sm text-[#584235]">
                    {formatCurrency(sale.total)}
                  </td>

                  {/* Action */}
                  <td className="py-4 px-6 text-center">
                    <button
                      onClick={() => onViewInvoice(sale)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#E63946] hover:text-white text-[#584235] text-xs font-bold transition-all cursor-pointer shadow-xs"
                      title="Ver factura completa"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Factura</span>
                    </button>
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
