import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateOrderModal from '../../src/app/orders/components/CreateOrderModal';
import { createOrder } from '../../src/app/orders/services/orderService';
import { showErrorAlert } from '../../src/app/common/alertUtils';
import { callOf, jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const BURGER = { id: 1, name: 'Hamburguesa', categoryId: 1, category: { name: 'Hamburguesas' }, salePrice: 8.5 };

function mockApi(orderResponse) {
  return mockFetchRoutes({
    'GET /api/products': jsonResponse([BURGER]),
    'GET /api/categories': jsonResponse([{ id: 1, name: 'Hamburguesas' }]),
    'POST /api/orders': orderResponse,
  });
}

// El modal recibe la función REAL del service como onSubmit: se prueba todo el camino
// servicio -> mensaje del backend -> banner del modal.
async function openAndSend() {
  const onClose = vi.fn();
  const user = userEvent.setup({ delay: null });
  render(<CreateOrderModal isOpen onClose={onClose} onSubmit={createOrder} />);

  await user.click(await screen.findByRole('heading', { name: 'Hamburguesa' })); // el clic sube hasta la tarjeta del producto
  await user.click(screen.getByRole('button', { name: /Despachar a Cocina/ }));
  return { onClose, user };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
});

describe('<CreateOrderModal /> errores del servidor (B7)', () => {
  it('si falta stock (400) muestra en el banner el detalle que viene en "error" y no cierra', async () => {
    const detail = 'Stock insuficiente de "Pan" para 2 x Hamburguesa: necesitas 2 und y solo hay 1 und.';
    mockApi(jsonResponse({ error: detail }, 400));
    const { onClose } = await openAndSend();

    expect(await screen.findByText(detail)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(showErrorAlert).not.toHaveBeenCalled();
    // el carrito se conserva y se puede reintentar
    expect(screen.getByRole('button', { name: /Despachar a Cocina/ })).toBeEnabled();
  });

  it('el texto "details" técnico (objeto) del servidor no se muestra', async () => {
    mockApi(jsonResponse({ error: 'Error al crear la comanda', details: { code: 'P2003' } }, 500));
    await openAndSend();

    expect(await screen.findByText('Error al crear la comanda')).toBeInTheDocument();
    expect(screen.queryByText(/P2003/)).not.toBeInTheDocument();
  });

  it('si la caja está cerrada muestra el banner y además la alerta "Caja Cerrada" (el texto se reconoce por contenido, I7)', async () => {
    mockApi(
      jsonResponse({ error: 'No se puede crear la comanda porque la caja está cerrada. Abra un turno de caja primero.' }, 400)
    );
    await openAndSend();

    expect(await screen.findByText(/porque la caja está cerrada/)).toBeInTheDocument();
    expect(showErrorAlert).toHaveBeenCalledWith('Caja Cerrada', expect.stringMatching(/abrir un turno de caja/));
  });

  it('con el backend caído muestra el aviso de conexión en español', async () => {
    // el menú carga bien, pero al enviar la comanda el servidor no responde
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        if (options.method === 'POST') throw new TypeError('Failed to fetch');
        return jsonResponse(url.includes('/api/products') ? [BURGER] : []);
      })
    );
    await openAndSend();

    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
  });

  it('si todo sale bien envía la comanda con precios numéricos y cierra', async () => {
    const fetchMock = mockApi(jsonResponse({ id: 5, number: 'ORD-0005' }, 201));
    const { onClose } = await openAndSend();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const post = fetchMock.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(callOf({ mock: { calls: [post] } }).body).toEqual({
      items: [{ productId: 1, quantity: 1, unitPrice: 8.5 }],
    });
    expect(screen.queryByText(/Stock insuficiente/)).not.toBeInTheDocument();
  });
});
