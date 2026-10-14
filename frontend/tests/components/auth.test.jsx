import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/app/auth/AuthContext';
import ProtectedRoute from '../../src/app/auth/ProtectedRoute';
import LoginPage from '../../src/app/auth/LoginPage';
import { jsonResponse, mockFetch } from '../helpers/fetchMock';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const STORAGE_KEY = 'masterfood_auth_user';
const admin = { id: 1, fullName: 'Administrador', username: 'Admin', role: 'ADMIN', active: true };
const worker = { id: 2, fullName: 'María', username: 'maria', role: 'WORKER', active: true };

/** Simula una sesión ya iniciada (la app guarda el usuario en sessionStorage). */
function signIn(user) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function renderRoutes(initialPath) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<h1>Panel</h1>} />
          </Route>
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute adminOnly>
                <h1>Usuarios</h1>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function Probe() {
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">{`${user?.username ?? 'anon'}|${isAdmin}|${isAuthenticated}`}</span>
      <button onClick={logout}>salir</button>
    </div>
  );
}

describe('AuthContext', () => {
  it('useAuth fuera del proveedor lanza un error claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('restaura la sesión desde sessionStorage y logout la borra', async () => {
    signIn(admin);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true');

    await user.click(screen.getByText('salir'));
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignora una sesión guardada corrupta', () => {
    sessionStorage.setItem(STORAGE_KEY, '{no-es-json');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
  });

  it('un usuario inactivo no cuenta como autenticado', () => {
    signIn({ ...worker, active: false });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('state')).toHaveTextContent('maria|false|false');
  });
});

describe('<ProtectedRoute />', () => {
  it('sin sesión redirige a /login', () => {
    renderRoutes('/');
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
  });

  it('con sesión muestra la página', () => {
    signIn(worker);
    renderRoutes('/');
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument();
  });

  it('adminOnly: un trabajador es devuelto al inicio; un admin entra', () => {
    signIn(worker);
    const { unmount } = renderRoutes('/usuarios');
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument();
    unmount();

    signIn(admin);
    renderRoutes('/usuarios');
    expect(screen.getByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
  });
});

describe('<LoginPage />', () => {
  const fill = async (user, username, password) => {
    if (username) await user.type(screen.getByPlaceholderText(/Tu nombre de usuario/), username);
    if (password) await user.type(screen.getByPlaceholderText(/Tu contraseña/), password);
    await user.click(screen.getByRole('button', { name: /Ingresar al Sistema/ }));
  };

  it('valida contraseña corta sin llamar al servidor', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    const user = userEvent.setup();
    renderRoutes('/login');

    await fill(user, 'Admin', '123');
    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra el error del backend cuando las credenciales son incorrectas', async () => {
    mockFetch(jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401));
    const user = userEvent.setup();
    renderRoutes('/login');

    await fill(user, 'Admin', 'mala-clave');
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('con credenciales válidas guarda la sesión y navega al panel', async () => {
    mockFetch(jsonResponse({ user: admin }));
    const user = userEvent.setup();
    renderRoutes('/login');

    await fill(user, '  Admin  ', '123456');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument());
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY))).toMatchObject({ username: 'Admin', role: 'ADMIN' });
  });

  it('el botón del ojo alterna la visibilidad de la contraseña', async () => {
    const user = userEvent.setup();
    renderRoutes('/login');
    const input = screen.getByPlaceholderText(/Tu contraseña/);
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByTitle('Ver contraseña'));
    expect(input).toHaveAttribute('type', 'text');
  });
});
