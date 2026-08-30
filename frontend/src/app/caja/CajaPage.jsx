import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw, Receipt, Plus } from 'lucide-react';
import PaymentMethodSwitcher from './components/PaymentMethodSwitcher';
import CajaHeaderCard from './components/CajaHeaderCard';
import SaleTable from './components/SaleTable';
import InvoiceDetailModal from './components/InvoiceDetailModal';
import DirectSaleModal from './components/DirectSaleModal';
import { fetchSales, createDirectSale } from './services/cajaService';
import { showSuccessToast, showErrorAlert } from '../common/alertUtils';

export default function CajaPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activePaymentMethod, setActivePaymentMethod] = useState('all');

  // Modals state
  const [directSaleModalOpen, setDirectSaleModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // Load sales history
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchSales()
      .then((data) => {
        setSales(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando facturas de caja:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar las facturas de caja.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let digital = 0;
    const methodCounts = { all: sales.length, CASH: 0, CARD: 0, TRANSFER: 0, MIXED: 0 };

    sales.forEach((s) => {
      const amount = Number(s.total) || 0;
      total += amount;

      if (s.paymentMethod === 'CASH') {
        cash += amount;
      } else {
        digital += amount;
      }

      if (methodCounts[s.paymentMethod] !== undefined) {
        methodCounts[s.paymentMethod]++;
      }
    });

    return {
      totalRevenue: total,
      cashTotal: cash,
      digitalTotal: digital,
      invoicesCount: sales.length,
      methodCounts,
    };
  }, [sales]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Search term
      const matchesSearch =
        sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sale.paymentMethod && sale.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Method filter
      if (activePaymentMethod !== 'all' && sale.paymentMethod !== activePaymentMethod) {
        return false;
      }

      return true;
    });
  }, [sales, searchTerm, activePaymentMethod]);

  // Handlers
  const handleOpenInvoice = (sale) => {
    setSelectedSale(sale);
    setInvoiceModalOpen(true);
  };

  const handleCreateDirectSale = async (payload) => {
    try {
      const created = await createDirectSale(payload);
      showSuccessToast(`Factura ${created.invoiceNumber || ''} emitida correctamente.`);
      loadData();
    } catch (err) {
      showErrorAlert('Error al emitir factura', err.message || 'No se pudo registrar la venta.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* TOP SWITCHER: Payment Methods Filter */}
      <PaymentMethodSwitcher
        activeMethod={activePaymentMethod}
        onSelectMethod={setActivePaymentMethod}
        counts={metrics.methodCounts}
      />

      {/* CONTAINER 1: Header Card with Metrics */}
      <CajaHeaderCard
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onNewSaleClick={() => setDirectSaleModalOpen(true)}
        totalRevenue={metrics.totalRevenue}
        cashTotal={metrics.cashTotal}
        digitalTotal={metrics.digitalTotal}
        invoicesCount={filteredSales.length}
      />

      {/* CONTAINER 2: Sales Invoices Table / States */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-8 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al conectar con la API de Caja</p>
              <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-[#584235]">No hay facturas registradas</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm || activePaymentMethod !== 'all'
              ? 'No se encontraron facturas con los filtros aplicados.'
              : 'Las ventas cobradas y comandas despachadas aparecerán aquí automáticamente.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => setDirectSaleModalOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Realizar Primer Cobro</span>
            </button>
          </div>
        </div>
      ) : (
        <SaleTable
          sales={filteredSales}
          onViewInvoice={handleOpenInvoice}
        />
      )}

      {/* Modal: Direct Sale POS */}
      <DirectSaleModal
        isOpen={directSaleModalOpen}
        onClose={() => setDirectSaleModalOpen(false)}
        onSubmit={handleCreateDirectSale}
      />

      {/* Modal: Invoice / Receipt View */}
      <InvoiceDetailModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        sale={selectedSale}
      />
    </div>
  );
}
