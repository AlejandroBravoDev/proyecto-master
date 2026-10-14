import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InventoryPage from '../../src/app/inventory/InventoryPage';
import { showErrorAlert, showSuccessToast } from '../../src/app/common/alertUtils';
import { blobResponse, jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';
import { renderAsAdmin } from '../helpers/renderWithApp';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const FLOUR = { id: 2, name: 'Harina', measurementUnit: 'kg', currentStock: 10, minimumStock: 2, unitCost: 1.5, description: null };

function mockApi(extra = {}) {
  return mockFetchRoutes({
    'GET /api/ingredients': jsonResponse([FLOUR]),
    'GET /api/inventory/alerts': jsonResponse([]),
    ...extra,
  });
}

async function renderPage() {
  const user = userEvent.setup({ delay: null });
  const utils = renderAsAdmin(<InventoryPage />);
  await screen.findByText('Harina');
  return { user, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
  // jsdom no implementa estas APIs de descarga
  window.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('<InventoryPage /> feedback con SweetAlert (I6)', () => {
  it('muestra los insumos sin ningún toast propio en pantalla', async () => {
    mockApi();
    await renderPage();
    expect(screen.queryByText(/correctamente/)).not.toBeInTheDocument();
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it('descargar la plantilla avisa con showSuccessToast', async () => {
    mockApi({ 'GET /api/ingredients/template/ingredients': blobResponse('xlsx') });
    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: /Descargar Plantilla/ }));

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Plantilla descargada correctamente.'));
    expect(showErrorAlert).not.toHaveBeenCalled();
  });

  it('si la descarga de la plantilla falla muestra el error con showErrorAlert', async () => {
    mockApi({ 'GET /api/ingredients/template/ingredients': jsonResponse({}, 500) });
    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: /Descargar Plantilla/ }));

    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledTimes(1));
    expect(showErrorAlert).toHaveBeenCalledWith(
      'Error al descargar la plantilla',
      'Error (500): No se pudo descargar la plantilla de insumos.'
    );
    expect(showSuccessToast).not.toHaveBeenCalled();
    // el botón no se queda bloqueado
    expect(screen.getByRole('button', { name: /Descargar Plantilla/ })).toBeEnabled();
  });

  it('exportar el reporte avisa con showSuccessToast y, si falla, con showErrorAlert', async () => {
    mockApi({ 'GET /api/ingredients/export/ingredients': blobResponse('xlsx') });
    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: /Exportar Excel/ }));
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Reporte de inventario exportado a Excel.'));

    mockApi({ 'GET /api/ingredients/export/ingredients': jsonResponse({ error: 'No hay insumos para exportar.' }, 400) });
    await user.click(screen.getByRole('button', { name: /Exportar Excel/ }));
    await waitFor(() =>
      expect(showErrorAlert).toHaveBeenCalledWith('Error al exportar el reporte', 'No hay insumos para exportar.')
    );
  });

  it('crear un insumo avisa con showSuccessToast y recarga el listado', async () => {
    const fetchMock = mockApi({ 'POST /api/ingredients': jsonResponse({ id: 3 }, 201) });
    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: /Nuevo Insumo/ }));
    await user.type(await screen.findByPlaceholderText(/Carne de Res 150g/), 'Sal');
    await user.click(screen.getByRole('button', { name: /Crear Insumo/ }));

    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Insumo creado correctamente.'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url, o]) => /\/api\/ingredients$/.test(url) && (o?.method ?? 'GET') === 'GET')).toHaveLength(2)
    );
  });

  it('con el backend caído muestra el error en español con "Reintentar"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderAsAdmin(<InventoryPage />);

    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
