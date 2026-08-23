import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import DashboardHeaderCard from './components/DashboardHeaderCard';
import MetricCard from './components/MetricCard';
import TopProductsWidget from './components/TopProductsWidget';
import CriticalInventoryWidget from './components/CriticalInventoryWidget';
import { fetchDashboardKPIs } from './services/dashboardService';

export default function DashboardPage() {
  const [data, setData] = useState({
    cards: [],
    topSellingProducts: [],
    criticalStockIngredients: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchDashboardKPIs()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error al cargar KPIs reales del dashboard:', err);
        setError(err.message || 'No se pudo conectar con el servidor.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Top Header Card */}
      <DashboardHeaderCard
        title="Dashboard MasterFood"
        subtitle="Aquí podrás ver un resumen muy completo del negocio"
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-6">
          {/* Skeleton for KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-white border border-slate-200" />
            ))}
          </div>

          {/* Skeleton for Bottom Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="h-72 rounded-3xl bg-white border border-slate-200" />
            <div className="h-72 rounded-3xl bg-white border border-slate-200" />
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl bg-rose-50 border border-rose-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-800 shadow-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-[#E63946] shrink-0" />
            <div>
              <p className="font-bold text-[#584235]">Error al consultar la API del Dashboard</p>
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
      ) : (
        <>
          {/* 4 Metric KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {data.cards.map((metric) => (
              <MetricCard key={metric.id} metric={metric} />
            ))}
          </div>

          {/* Bottom Grid: Top Products & Critical Inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopProductsWidget products={data.topSellingProducts} />
            <CriticalInventoryWidget ingredients={data.criticalStockIngredients} />
          </div>
        </>
      )}
    </div>
  );
}
