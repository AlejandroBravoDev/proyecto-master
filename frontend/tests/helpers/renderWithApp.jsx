import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/app/auth/AuthContext';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../src/app/auth/authStorage';

export const ADMIN_USER = { id: 1, fullName: 'Administrador', username: 'Admin', role: 'ADMIN', active: true };
export const WORKER_USER = { id: 2, fullName: 'María Pérez', username: 'maria', role: 'WORKER', active: true };

/** Token de las sesiones simuladas: las peticiones de las pantallas lo envían como `Bearer test-token`. */
export const TEST_TOKEN = 'test-token';

/**
 * Deja una sesión iniciada en `sessionStorage` (usuario + token), como si ya se hubiera pasado por el login.
 * Sin token la sesión no cuenta: `AuthProvider` la trata como no autenticada.
 */
export function signInAs(user, token = TEST_TOKEN) {
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Monta `ui` con sesión iniciada (sessionStorage precargado), AuthProvider y MemoryRouter.
 * La app real usa createHashRouter; en pruebas siempre MemoryRouter.
 *
 * El proveedor se monta con `validateOnMount={false}`: la app real valida la sesión con
 * `GET /api/auth/me` al arrancar, pero las pruebas de pantallas simulan `fetch` en orden y no
 * quieren una llamada extra. Esa validación se prueba aparte (`tests/components/auth.test.jsx`).
 *
 *   renderWithApp(<UsersPage />, { user: WORKER_USER, route: '/usuarios' });
 */
export function renderWithApp(ui, { user = ADMIN_USER, route = '/' } = {}) {
  if (user) signInAs(user);
  // Con `wrapper`, `rerender(<Componente ... />)` conserva el AuthProvider y el router.
  const Providers = ({ children }) => (
    <AuthProvider validateOnMount={false}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </AuthProvider>
  );
  return render(ui, { wrapper: Providers });
}

export const renderAsAdmin = (ui, options) => renderWithApp(ui, { ...options, user: ADMIN_USER });
export const renderAsWorker = (ui, options) => renderWithApp(ui, { ...options, user: WORKER_USER });
