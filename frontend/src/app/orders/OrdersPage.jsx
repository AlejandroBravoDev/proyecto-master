import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, RefreshCw, ClipboardList, Plus } from 'lucide-react';
import OrderHeaderCard from './components/OrderHeaderCard';
import OrderCard from './components/OrderCard';
import CreateOrderModal from './components/CreateOrderModal';
import OrderDetailModal from './components/OrderDetailModal';
import { fetchOrders, createOrder, deleteOrder } from './services/orderService';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../common/alertUtils';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Load orders
  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchOrders()
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando comandas:', err);
        setError(err.message || 'No se pudo conectar con el servidor para cargar las comandas.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total sales sum
  const totalSalesAmount = useMemo(() => {
    return orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.notes && order.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [orders, searchTerm]);

  // Handlers
  const handleCreateOrder = async (payload) => {
    await createOrder(payload);
    showSuccessToast('Comanda despachada a cocina y stock descontado.');
    loadData();
  };

  const handleOpenDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleDeleteOrder = async (order) => {
    const result = await confirmDialog({
      title: `¿Eliminar comanda ${order.number}?`,
      text: 'Se eliminará la comanda del registro del sistema.',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        await deleteOrder(order.id);
        showSuccessToast(`Comanda ${order.number} eliminada.`);
        loadData();
      } catch (err) {
        showErrorAlert('Error al eliminar comanda', err.message || 'No se pudo eliminar la comanda.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header Card */}
      <OrderHeaderCard
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onNewOrderClick={() => setCreateModalOpen(true)}
        totalOrdersCount={orders.length}
        totalSalesAmount={totalSalesAmount}
      />

      {/* Orders Grid / States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-white border border-slate-200" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al conectar con la API de Comandas</p>
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
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-12 text-center space-y-3">
          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-[#584235]">No hay comandas registradas</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? 'No se encontraron pedidos con el término de búsqueda.'
              : 'Empieza registrando una nueva comanda desde el punto de pedidos.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#E63946] hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tomar Primer Pedido</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetail={handleOpenDetail}
              onDelete={handleDeleteOrder}
            />
          ))}
        </div>
      )}

      {/* Modal: POS Create Order */}
      <CreateOrderModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateOrder}
      />

      {/* Modal: Order Ticket Detail */}
      <OrderDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        order={selectedOrder}
      />
    </div>
  );
}
