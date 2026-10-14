import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryModal from '../../src/app/products/components/CategoryModal';
import { confirmDialog, showErrorAlert, showSuccessToast } from '../../src/app/common/alertUtils';
import { callOf, jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const CATEGORIES = [
  { id: 4, name: 'Bebidas', description: 'Frías y calientes' },
  { id: 5, name: 'Postres' },
];

function setup(props = {}) {
  const onCategoriesChanged = props.onCategoriesChanged ?? vi.fn();
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <CategoryModal isOpen onClose={() => {}} categories={CATEGORIES} onCategoriesChanged={onCategoriesChanged} {...props} />
  );
  return { onCategoriesChanged, user, ...utils };
}

const deleteButtons = () => screen.getAllByTitle('Eliminar categoría');

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
  confirmDialog.mockResolvedValue({ isConfirmed: true });
});

describe('<CategoryModal /> eliminar (B5)', () => {
  it('el texto de confirmación no promete que los productos "quedarán sin categoría"', async () => {
    mockFetchRoutes({ 'DELETE /api/categories/4': jsonResponse({ message: 'ok' }) });
    const { user } = setup();
    await user.click(deleteButtons()[0]);

    expect(confirmDialog).toHaveBeenCalledTimes(1);
    const { title, text } = confirmDialog.mock.calls[0][0];
    expect(title).toBe('¿Eliminar categoría "Bebidas"?');
    expect(text).not.toMatch(/quedarán sin categoría/);
    expect(text).toMatch(/no tenga productos/);
    expect(text).toMatch(/mueve esos productos a otra categoría o elimínalos primero/);
  });

  it('si el servidor rechaza el borrado (la categoría tiene productos) muestra SU mensaje con showErrorAlert', async () => {
    const message = 'No se puede eliminar la categoría "Bebidas" porque tiene 3 producto(s). Muévelos o elimínalos primero.';
    mockFetchRoutes({ 'DELETE /api/categories/4': jsonResponse({ error: message }, 400) });
    const { onCategoriesChanged, user } = setup();
    await user.click(deleteButtons()[0]);

    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledTimes(1));
    expect(showErrorAlert).toHaveBeenCalledWith('Error al eliminar categoría', message);
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(onCategoriesChanged).not.toHaveBeenCalled();
    // el botón vuelve a estar disponible (no queda bloqueado)
    expect(deleteButtons()[0]).toBeEnabled();
  });

  it('si no se confirma no se llama al servidor', async () => {
    confirmDialog.mockResolvedValue({ isConfirmed: false });
    const fetchMock = mockFetchRoutes({ 'DELETE /api/categories/4': jsonResponse({ message: 'ok' }) });
    const { user } = setup();
    await user.click(deleteButtons()[0]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(showErrorAlert).not.toHaveBeenCalled();
  });

  it('si se elimina bien avisa y recarga las categorías', async () => {
    const fetchMock = mockFetchRoutes({ 'DELETE /api/categories/5': jsonResponse({ message: 'ok' }) });
    const { onCategoriesChanged, user } = setup();
    await user.click(deleteButtons()[1]);

    await waitFor(() => expect(onCategoriesChanged).toHaveBeenCalledTimes(1));
    expect(callOf(fetchMock).options.method).toBe('DELETE');
    expect(showSuccessToast).toHaveBeenCalledWith('Categoría "Postres" eliminada.');
    expect(showErrorAlert).not.toHaveBeenCalled();
  });

  it('con el backend caído muestra el aviso de conexión en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { user } = setup();
    await user.click(deleteButtons()[0]);

    await waitFor(() => expect(showErrorAlert).toHaveBeenCalledTimes(1));
    expect(showErrorAlert.mock.calls[0][1]).toMatch(/No se pudo conectar con el servidor/);
  });
});
