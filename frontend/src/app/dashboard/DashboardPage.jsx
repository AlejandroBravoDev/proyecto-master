import React, { useEffect, useState } from 'react';
import DashboardHeader from './components/DashboardHeader';
import MetricCard from './components/MetricCard';
import { fetchDashboardMetrics } from './services/dashboardService';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchDashboardMetrics()
      .then((data) => {
        if (isMounted) {
          setMetrics(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error loading dashboard metrics:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <DashboardHeader
        title="Dashboard"
        description="Bienvenido al panel principal de tu aplicación."
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}
    </div>
  );
}
