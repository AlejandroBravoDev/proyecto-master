import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/app/auth/AuthContext';
import ProtectedRoute from '../../src/app/auth/ProtectedRoute';
import LoginPage from '../../src/app/auth/LoginPage';
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from '../../src/app/auth/authStorage';
import { requestJson } from '../../src/config/apiFetch';
import { callOf, jsonResponse, mockFetch, mockFetchRoutes } from '../helpers/fetchMock';

vi.mock('../../src/app/common/alertUtils', () => ({
  showSuccessToast: vi.fn(),
  showErrorAlert: vi.fn(),
  confirmDialog: vi.fn(),
}));

const BASE = 'http://localhost:3055';
const TOKEN = 'jwt-de-prueba';
const EXPIRED_NOTICE = 'Tu sesión expiró. Inicia sesión de nuevo.';
const admin = { id: 1, fullName: 'Administrador', username: 'Admin', role: 'ADMIN', active: true };
const worker = { id: 2, fullName: 'María', username: 'maria', role: 'WORKER', active: true };

/** Simula una sesión ya iniciada: la app guarda el usuario y el token en sessionStorage. */
function signIn(user, token = TOKEN) {
  setStoredUser(user);
  if (token) setStoredToken(token);
}

const unauthorized = (code, error = 'Sesión no válida.') => jsonResponse({ error, code }, 401);

/** Espera a que terminen las promesas pendientes (para comprobar que NO pasó nada). */
const flushPromises = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

function renderRoutes(initialPath, { validate = false } = {}) {
  return render(
    <AuthProvider validateOnMount={validate}>
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
  const { user, isAdmin, isAuthenticated, sessionNotice, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">{`${user?.username ?? 'anon'}|${isAdmin}|${isAuthenticated}`}</span>
      <span data-testid="notice">{sessionNotice}</span>
      <button onClick={logout}>salir</button>
      <button onClick={() => login('Admin', '123456').catch(() => {})}>entrar</button>
      <button onClick={() => Promise.allSettled([requestJson(`${BASE}/api/a`), requestJson(`${BASE}/api/b`)])}>pedir</button>
    </div>
  );
}

const renderProbe = ({ validate = false } = {}) =>
  render(
    <AuthProvider validateOnMount={validate}>
      <Probe />
    </AuthProvider>
  );

describe('AuthContext', () => {
  it('useAuth fuera del proveedor lanza un error claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('restaura la sesión desde sessionStorage y logout borra usuario y token', async () => {
    signIn(admin);
    const user = userEvent.setup();
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true');

    await user.click(screen.getByText('salir'));
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it('ignora una sesión guardada corrupta', () => {
    sessionStorage.setItem(AUTH_USER_KEY, '{no-es-json');
    setStoredToken(TOKEN);
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
  });

  it('un usuario inactivo no cuenta como autenticado', () => {
    signIn({ ...worker, active: false });
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('maria|false|false');
  });

  it('un usuario guardado SIN token (sesión anterior al JWT) no está autenticado y se limpia', () => {
    signIn(admin, null);
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
  });

  it('un token sin usuario guardado tampoco es una sesión y se limpia', () => {
    setStoredToken(TOKEN);
    renderProbe();
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(getStoredToken()).toBeNull();
  });

  it('login guarda el token y el usuario, y deja el estado autenticado', async () => {
    const fetchMock = mockFetch(jsonResponse({ user: admin, token: TOKEN }));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('entrar'));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true'));
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe(TOKEN);
    expect(getStoredUser()).toMatchObject({ username: 'Admin', role: 'ADMIN' });
    expect(callOf(fetchMock).options.headers).not.toHaveProperty('Authorization');
  });

  it('login rechazado (credenciales incorrectas) no deja token ni usuario', async () => {
    mockFetch(jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('entrar'));

    await flushPromises();
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('login con una respuesta sin token no inicia sesión', async () => {
    mockFetch(jsonResponse({ user: admin }));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('entrar'));

    await flushPromises();
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(getStoredUser()).toBeNull();
  });
});

describe('AuthContext: validación de la sesión al montar (GET /api/auth/me)', () => {
  it('pide /api/auth/me con el token y actualiza el usuario guardado (rol/estado frescos)', async () => {
    vi.stubEnv('VITE_API_URL', BASE);
    signIn(worker);
    const fetchMock = mockFetch(jsonResponse({ user: { ...worker, role: 'ADMIN' } }));
    renderProbe({ validate: true });
    expect(screen.getByTestId('state')).toHaveTextContent('maria|false|true'); // primero, lo guardado

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('maria|true|true'));

    const { url, options } = callOf(fetchMock);
    expect(url).toBe(`${BASE}/api/auth/me`);
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(getStoredUser()).toMatchObject({ username: 'maria', role: 'ADMIN' });
    expect(getStoredToken()).toBe(TOKEN);
  });

  it('un 401 cierra la sesión: usuario null, token borrado y aviso de sesión expirada', async () => {
    signIn(admin);
    mockFetch(unauthorized('TOKEN_EXPIRED'));
    renderProbe({ validate: true });

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false'));
    expect(screen.getByTestId('notice')).toHaveTextContent(EXPIRED_NOTICE);
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it.each(['NO_TOKEN', 'INVALID_TOKEN', 'TOKEN_EXPIRED', null])(
    'el código %s muestra el aviso genérico de sesión expirada',
    async (code) => {
      signIn(admin);
      mockFetch(jsonResponse({ error: 'texto del servidor que no se muestra', ...(code ? { code } : {}) }, 401));
      renderProbe({ validate: true });

      await waitFor(() => expect(screen.getByTestId('notice')).toHaveTextContent(EXPIRED_NOTICE));
    }
  );

  it('USER_INACTIVE muestra el texto que manda el servidor', async () => {
    signIn(worker);
    mockFetch(unauthorized('USER_INACTIVE', 'Tu usuario está desactivado. Contacta al administrador.'));
    renderProbe({ validate: true });

    await waitFor(() =>
      expect(screen.getByTestId('notice')).toHaveTextContent('Tu usuario está desactivado. Contacta al administrador.')
    );
    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
  });

  it('si el backend no responde (red caída) mantiene la sesión guardada', async () => {
    signIn(admin);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    renderProbe({ validate: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await flushPromises();

    expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true');
    expect(screen.getByTestId('notice')).toBeEmptyDOMElement();
    expect(getStoredToken()).toBe(TOKEN);
    expect(getStoredUser()).toMatchObject({ username: 'Admin' });
  });

  it('un error 500 del servidor tampoco cierra la sesión', async () => {
    signIn(admin);
    const fetchMock = mockFetch(jsonResponse({ error: 'Error interno' }, 500));
    renderProbe({ validate: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await flushPromises();

    expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true');
    expect(getStoredToken()).toBe(TOKEN);
  });

  it('una respuesta sin usuario se ignora y conserva la sesión guardada', async () => {
    signIn(admin);
    const fetchMock = mockFetch(jsonResponse({}));
    renderProbe({ validate: true });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await flushPromises();

    expect(screen.getByTestId('state')).toHaveTextContent('Admin|true|true');
  });

  it('sin sesión guardada no llama al servidor', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    renderProbe({ validate: true });

    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con validateOnMount={false} no hace la petición', async () => {
    signIn(admin);
    const fetchMock = mockFetch(jsonResponse({}));
    renderProbe({ validate: false });

    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si se cierra la sesión mientras /me está en vuelo, su respuesta se descarta', async () => {
    signIn(admin);
    let respond;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => (respond = resolve))));
    const user = userEvent.setup();
    renderProbe({ validate: true });

    await user.click(screen.getByText('salir'));
    respond(jsonResponse({ user: admin }));
    await flushPromises();

    expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false');
    expect(getStoredUser()).toBeNull();
  });
});

describe('AuthContext: 401 en cualquier petición de la app', () => {
  it('cierra la sesión UNA vez aunque varias peticiones paralelas reciban 401', async () => {
    signIn(admin);
    const fetchMock = mockFetch(unauthorized('INVALID_TOKEN'));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('pedir'));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anon|false|false'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('notice')).toHaveTextContent(EXPIRED_NOTICE);
    expect(getStoredToken()).toBeNull();
  });

  it('un 403 (rol insuficiente) no cierra la sesión', async () => {
    signIn(worker);
    const fetchMock = mockFetch(jsonResponse({ error: 'No tienes permisos para realizar esta acción.' }, 403));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByText('pedir'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await flushPromises();
    expect(screen.getByTestId('state')).toHaveTextContent('maria|false|true');
    expect(screen.getByTestId('notice')).toBeEmptyDOMElement();
    expect(getStoredToken()).toBe(TOKEN);
  });

  it('cerrar sesión a mano borra el aviso de una sesión expirada anterior', async () => {
    signIn(admin);
    mockFetch(unauthorized('TOKEN_EXPIRED'));
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByText('pedir'));
    await waitFor(() => expect(screen.getByTestId('notice')).toHaveTextContent(EXPIRED_NOTICE));

    await user.click(screen.getByText('salir'));
    expect(screen.getByTestId('notice')).toBeEmptyDOMElement();
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

  it('un usuario sin token (sesión anterior al JWT) es enviado a /login', () => {
    signIn(worker, null);
    renderRoutes('/');
    expect(screen.getByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
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

  it('una sesión expirada lleva al login con el aviso y, al volver a entrar, regresa a la pantalla en la que estaba', async () => {
    vi.stubEnv('VITE_API_URL', BASE);
    signIn(admin);
    mockFetchRoutes({
      'GET /api/auth/me': unauthorized('TOKEN_EXPIRED'),
      'POST /api/auth/login': jsonResponse({ user: admin, token: 'token-nuevo' }),
    });
    const user = userEvent.setup();
    renderRoutes('/usuarios', { validate: true });

    // /me responde 401: sale del panel de usuarios hacia el login, con el aviso
    expect(await screen.findByRole('heading', { name: 'Iniciar Sesión' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(EXPIRED_NOTICE);

    await user.type(screen.getByPlaceholderText(/Tu nombre de usuario/), 'Admin');
    await user.type(screen.getByPlaceholderText(/Tu contraseña/), '123456');
    await user.click(screen.getByRole('button', { name: /Ingresar al Sistema/ }));

    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    expect(getStoredToken()).toBe('token-nuevo');
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
    expect(sessionStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
  });

  it('con credenciales válidas guarda token y usuario y navega al panel', async () => {
    mockFetch(jsonResponse({ user: admin, token: TOKEN }));
    const user = userEvent.setup();
    renderRoutes('/login');

    await fill(user, '  Admin  ', '123456');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument());
    expect(getStoredUser()).toMatchObject({ username: 'Admin', role: 'ADMIN' });
    expect(getStoredToken()).toBe(TOKEN);
  });

  it('si el servidor no devuelve token muestra un error y no entra', async () => {
    mockFetch(jsonResponse({ user: admin }));
    const user = userEvent.setup();
    renderRoutes('/login');

    await fill(user, 'Admin', '123456');
    expect(await screen.findByText(/no devolvió una sesión válida/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel' })).not.toBeInTheDocument();
    expect(getStoredUser()).toBeNull();
  });

  it('no muestra ningún aviso de sesión si no hubo una sesión expirada', () => {
    renderRoutes('/login');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra el aviso de sesión expirada y lo quita al intentar entrar', async () => {
    signIn(admin);
    mockFetchRoutes({
      'GET /api/auth/me': unauthorized('INVALID_TOKEN'),
      'POST /api/auth/login': jsonResponse({ error: 'Usuario o contraseña incorrectos.' }, 401),
    });
    vi.stubEnv('VITE_API_URL', BASE);
    const user = userEvent.setup();
    renderRoutes('/', { validate: true });

    expect(await screen.findByRole('status')).toHaveTextContent(EXPIRED_NOTICE);

    await fill(user, 'Admin', 'mala-clave');
    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra el texto del servidor cuando el usuario fue desactivado', async () => {
    signIn(worker);
    vi.stubEnv('VITE_API_URL', BASE);
    mockFetch(unauthorized('USER_INACTIVE', 'Tu usuario está desactivado. Contacta al administrador.'));
    renderRoutes('/', { validate: true });

    expect(await screen.findByRole('status')).toHaveTextContent('Tu usuario está desactivado. Contacta al administrador.');
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
