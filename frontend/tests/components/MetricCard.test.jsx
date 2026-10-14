import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import MetricCard from '../../src/app/dashboard/components/MetricCard';
import DashboardPage from '../../src/app/dashboard/DashboardPage';
import { jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';
import { renderAsAdmin } from '../helpers/renderWithApp';

const REVENUE = {
  id: 'total-revenue',
  key: 'totalRevenue',
  title: 'Ingresos Totales',
  rawValue: 1299.5,
  type: 'currency',
  category: 'totalRevenue',
  description: 'Facturación bruta acumulada',
};
const UNITS = {
  id: 'total-items-sold',
  key: 'totalItemsSold',
  title: 'Cantidad Vendida',
  rawValue: 1234,
  type: 'number',
  category: 'totalItemsSold',
  description: 'Unidades despachadas',
};
const ALERTS = {
  id: 'stock-alerts',
  key: 'stockAlertsCount',
  title: 'Alertas de Stock',
  rawValue: 3,
  type: 'number',
  category: 'stockAlertsCount',
  description: 'Productos con bajo inventario',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('<MetricCard /> (B11: nada de cifras inventadas)', () => {
  it('no muestra un porcentaje de variación si el backend no lo envía; muestra la descripción', () => {
    renderAsAdmin(<MetricCard metric={UNITS} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText('+2.5%')).not.toBeInTheDocument();
    expect(screen.getByText('Unidades despachadas')).toBeInTheDocument();
  });

  it.each([
    [3.24, '+3.2%'],
    [-1, '-1.0%'],
    [0, '0.0%'],
  ])('si el backend envía trend=%s lo muestra como %s', (trend, text) => {
    renderAsAdmin(<MetricCard metric={{ ...UNITS, trend }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('Unidades despachadas')).not.toBeInTheDocument();
  });

  it.each([[NaN], [Infinity], ['5'], [null]])('ignora un trend inválido (%s)', (trend) => {
    renderAsAdmin(<MetricCard metric={{ ...UNITS, trend }} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText('Unidades despachadas')).toBeInTheDocument();
  });

  it('formatea las unidades con miles y el sufijo "und"', () => {
    renderAsAdmin(<MetricCard metric={UNITS} />);
    expect(screen.getByText('1,234 und')).toBeInTheDocument();
  });

  it('los importes empiezan ocultos y se muestran con el formato de moneda compartido', async () => {
    const user = userEvent.setup({ delay: null });
    renderAsAdmin(<MetricCard metric={REVENUE} />);

    expect(screen.getByText('$****')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mostrar/ }));
    expect(screen.getByText(/US\$\s?1\.299,50/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ocultar/ }));
    expect(screen.getByText('$****')).toBeInTheDocument();
  });

  it('la tarjeta de alertas de stock lleva al inventario filtrado', async () => {
    const user = userEvent.setup({ delay: null });
    function Where() {
      const location = useLocation();
      return <p>ruta:{location.pathname + location.search}</p>;
    }
    renderAsAdmin(
      <Routes>
        <Route path="/" element={<MetricCard metric={ALERTS} />} />
        <Route path="/inventario" element={<Where />} />
      </Routes>
    );

    expect(screen.getByText(/Ver alertas/)).toBeInTheDocument();
    await user.click(screen.getByText('Alertas de Stock'));
    expect(await screen.findByText('ruta:/inventario?tab=alerts')).toBeInTheDocument();
  });
});

describe('<DashboardPage /> no inventa métricas', () => {
  it('pinta las 4 tarjetas del backend sin el "+2.5%" fijo', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
    mockFetchRoutes({
      'GET /api/dashboard/kpis': jsonResponse({
        period: 'day',
        totalRevenue: 20.22,
        totalItemsSold: 3,
        grossProfit: 14.51,
        stockAlertsCount: 2,
        topSellingProducts: [],
        criticalStockIngredients: [],
      }),
    });

    renderAsAdmin(<DashboardPage />);

    expect(await screen.findByText('Ingresos Totales')).toBeInTheDocument();
    ['Cantidad Vendida', 'Ganancia Bruta', 'Alertas de Stock'].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
    expect(screen.queryByText('+2.5%')).not.toBeInTheDocument();
    expect(screen.getByText('Facturación bruta acumulada')).toBeInTheDocument();
  });

  it('con el backend caído muestra el error en español y "Reintentar"', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderAsAdmin(<DashboardPage />);

    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
