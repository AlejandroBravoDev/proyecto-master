import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/app/auth/AuthContext';

const STORAGE_KEY = 'masterfood_auth_user';

export const ADMIN_USER = { id: 1, fullName: 'Administrador', username: 'Admin', role: 'ADMIN', active: true };
export const WORKER_USER = { id: 2, fullName: 'María Pérez', username: 'maria', role: 'WORKER', active: true };

/**
 * Monta `ui` con sesión iniciada (sessionStorage precargado), AuthProvider y MemoryRouter.
 * La app real usa createHashRouter; en pruebas siempre MemoryRouter.
 *
 *   renderWithApp(<UsersPage />, { user: WORKER_USER, route: '/usuarios' });
 */
export function renderWithApp(ui, { user = ADMIN_USER, route = '/' } = {}) {
  if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  // Con `wrapper`, `rerender(<Componente ... />)` conserva el AuthProvider y el router.
  const Providers = ({ children }) => (
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </AuthProvider>
  );
  return render(ui, { wrapper: Providers });
}

export const renderAsAdmin = (ui, options) => renderWithApp(ui, { ...options, user: ADMIN_USER });
export const renderAsWorker = (ui, options) => renderWithApp(ui, { ...options, user: WORKER_USER });
