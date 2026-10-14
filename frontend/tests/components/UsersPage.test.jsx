import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from '../../src/app/users/UsersPage';
import UsersTable from '../../src/app/users/components/UsersTable';
import { jsonResponse, mockFetchRoutes } from '../helpers/fetchMock';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const makeUsers = (count, start = 1) =>
  Array.from({ length: count }, (_, i) => {
    const n = String(start + i).padStart(2, '0');
    return { id: start + i, fullName: `Trabajador ${n}`, username: `user${n}`, role: 'WORKER', active: true, joinedAt: '2026-03-15T12:00:00.000Z' };
  });

const dataRows = () => screen.getAllByRole('row').slice(1); // sin el encabezado
const counter = () => screen.getByText(/registros/);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_API_URL', 'http://localhost:3055');
});

describe('<UsersTable /> usa el paginador común', () => {
  it('muestra el componente Pagination (rango y botones) y avisa del cambio de página', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup({ delay: null });
    render(<UsersTable users={makeUsers(15)} currentPage={1} totalItems={40} itemsPerPage={15} onPageChange={onPageChange} />);

    expect(counter()).toHaveTextContent('Mostrando 1–15 de 40 registros');
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('ya no trae su paginador propio ("Página 1 de N" con flechas)', () => {
    render(<UsersTable users={makeUsers(3)} currentPage={1} totalItems={40} itemsPerPage={15} onPageChange={() => {}} />);
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Página siguiente')).not.toBeInTheDocument();
  });

  it('sin usuarios muestra el mensaje vacío y oculta el paginador', () => {
    render(<UsersTable users={[]} currentPage={1} totalItems={0} onPageChange={() => {}} />);
    expect(screen.getByText(/No se encontraron trabajadores/)).toBeInTheDocument();
    expect(screen.queryByText(/registros/)).not.toBeInTheDocument();
  });

  it('las acciones de la fila reciben el usuario', async () => {
    const onEdit = vi.fn();
    const onResetPassword = vi.fn();
    const onToggleStatus = vi.fn();
    const users = makeUsers(1);
    const user = userEvent.setup({ delay: null });
    render(
      <UsersTable users={users} totalItems={1} onEdit={onEdit} onResetPassword={onResetPassword} onToggleStatus={onToggleStatus} />
    );

    await user.click(screen.getByTitle('Editar datos del trabajador'));
    await user.click(screen.getByTitle(/Reasignar contraseña/));
    await user.click(screen.getByTitle(/Desactivar/));
    expect(onEdit).toHaveBeenCalledWith(users[0]);
    expect(onResetPassword).toHaveBeenCalledWith(users[0]);
    expect(onToggleStatus).toHaveBeenCalledWith(users[0]);
  });
});

describe('<UsersPage /> paginación (hoy el backend devuelve a todos los usuarios: I1)', () => {
  it('con 20 usuarios pagina en el cliente: 15 en la primera página y 5 en la segunda, sin volver a pedir datos', async () => {
    const fetchMock = mockFetchRoutes({ 'GET /api/users': jsonResponse(makeUsers(20)) });
    const user = userEvent.setup({ delay: null });
    render(<UsersPage />);

    await screen.findByText('Trabajador 01');
    expect(dataRows()).toHaveLength(15);
    expect(screen.queryByText('Trabajador 16')).not.toBeInTheDocument();
    expect(counter()).toHaveTextContent('Mostrando 1–15 de 20 registros');

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(await screen.findByText('Trabajador 16')).toBeInTheDocument();
    expect(dataRows()).toHaveLength(5);
    expect(counter()).toHaveTextContent('Mostrando 16–20 de 20 registros');
    expect(screen.queryByText('Trabajador 01')).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('con pocos usuarios muestra todos en una sola página', async () => {
    mockFetchRoutes({ 'GET /api/users': jsonResponse(makeUsers(3)) });
    render(<UsersPage />);

    await screen.findByText('Trabajador 01');
    expect(dataRows()).toHaveLength(3);
    expect(counter()).toHaveTextContent('Mostrando 1–3 de 3 registros');
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled();
  });

  it('buscar vuelve a la primera página y pagina el resultado filtrado', async () => {
    mockFetchRoutes({ 'GET /api/users': jsonResponse(makeUsers(20)) });
    const user = userEvent.setup({ delay: null });
    render(<UsersPage />);

    await screen.findByText('Trabajador 01');
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByText('Trabajador 16');

    await user.type(screen.getByPlaceholderText(/Buscar trabajador/), 'user1');
    // user10..user19 = 10 resultados, todos en la página 1
    expect(await screen.findByText('Trabajador 10')).toBeInTheDocument();
    expect(dataRows()).toHaveLength(10);
    expect(counter()).toHaveTextContent('Mostrando 1–10 de 10 registros');
  });

  it('si el backend pagina (devuelve una porción y el total), la muestra tal cual y pide la página elegida', async () => {
    const fetchMock = mockFetchRoutes({
      'GET /api/users': (url) => {
        const page = Number(new URL(url).searchParams.get('page'));
        const users = page === 2 ? makeUsers(15, 16) : makeUsers(15, 1);
        return jsonResponse({ total: 40, page, limit: 15, totalPages: 3, users });
      },
    });
    const user = userEvent.setup({ delay: null });
    render(<UsersPage />);

    await screen.findByText('Trabajador 01');
    expect(dataRows()).toHaveLength(15);
    expect(counter()).toHaveTextContent('Mostrando 1–15 de 40 registros');

    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(await screen.findByText('Trabajador 16')).toBeInTheDocument();
    expect(screen.queryByText('Trabajador 01')).not.toBeInTheDocument();
    expect(counter()).toHaveTextContent('Mostrando 16–30 de 40 registros');

    const pages = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('page'));
    expect(pages).toEqual(['1', '2']);
  });

  it('con el backend caído muestra el error en español y "Reintentar"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<UsersPage />);

    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument();
    expect(within(screen.getByText('Error al cargar usuarios').closest('div.rounded-3xl')).getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });
});
