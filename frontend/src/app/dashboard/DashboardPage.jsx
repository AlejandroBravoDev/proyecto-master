import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import DashboardHeader from './components/DashboardHeader';
import MetricCard from './components/MetricCard';
import { fetchDashboardKPIs } from './services/dashboardService';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchDashboardKPIs()
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error al cargar KPIs reales:', err);
        setError(err.message || 'No se pudo conectar con el servidor.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <DashboardHeader
        title="Dashboard"
        description="Resumen de indicadores clave de rendimiento (KPIs)."
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-rose-300">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Error de conexión</p>
              <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold border border-rose-500/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
}
