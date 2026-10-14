# Plantillas de pruebas del frontend

Todas asumen `frontend/tests/setup.js`, `tests/helpers/fetchMock.js` y `tests/helpers/renderWithApp.jsx`. Sustituye `suppliers`/`Supplier` por tu módulo.

## Contenido
- Service
- Modal de crear/editar
- Listado con tres estados
- Permisos por rol y 403 del servidor
- Sesión: token y 401
- Confirmación antes de eliminar
- Fallos típicos y su causa

## Service

Los services pasan por la capa HTTP compartida (`requestJson`), que añade `Authorization: Bearer <token>` si hay sesión guardada: para probarlo, guarda un token con `setStoredToken` (el `setup.js` limpia el almacenamiento tras cada prueba).

```js
// tests/services/supplierService.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brokenJsonResponse, callOf, jsonResponse, mockFetch } from '../helpers/fetchMock';
import { setStoredToken } from '../../src/app/auth/authStorage';
import { createSupplier, fetchSuppliers } from '../../src/app/suppliers/services/supplierService';

beforeEach(() => vi.stubEnv('VITE_API_URL', 'http://localhost:3055'));

it('fetchSuppliers pide GET /api/suppliers con la búsqueda codificada y el token de la sesión', async () => {
  setStoredToken('token-de-prueba');
  const fetchMock = mockFetch(jsonResponse([{ id: 1 }]));
  await expect(fetchSuppliers('a&b')).resolves.toEqual([{ id: 1 }]);
  expect(callOf(fetchMock).url).toBe('http://localhost:3055/api/suppliers?search=a%26b');
  expect(callOf(fetchMock).options.headers.Authorization).toBe('Bearer token-de-prueba');
});

it('createSupplier envía JSON y muestra el error del backend', async () => {
  const fetchMock = mockFetch(jsonResponse({ id: 2 }, 201));
  await createSupplier({ name: 'Acme' });
  expect(callOf(fetchMock)).toMatchObject({ body: { name: 'Acme' } });
  expect(callOf(fetchMock).options.method).toBe('POST');

  mockFetch(jsonResponse({ error: 'Ya existe un proveedor con ese nombre' }, 400));
  await expect(createSupplier({ name: 'Acme' })).rejects.toThrow('Ya existe un proveedor con ese nombre');

  mockFetch(brokenJsonResponse(502)); // proxy caído: cuerpo no es JSON
  await expect(createSupplier({ name: 'x' })).rejects.toThrow(/502/);
});
```

## Modal de crear/editar

Contrato de `frontend-modal-form`: props `isOpen`, `onClose`, `onSubmit`, `initialData`.

```jsx
// tests/components/SupplierModal.test.jsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SupplierModal from '../../src/app/suppliers/components/SupplierModal';

const setup = (props = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<SupplierModal isOpen onClose={onClose} onSubmit={onSubmit} {...props} />);
  return { onSubmit, onClose, user };
};

it('no renderiza nada cerrado', () => {
  const { container } = render(<SupplierModal isOpen={false} onClose={() => {}} onSubmit={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

it('valida el nombre y no llama a onSubmit', async () => {
  const { onSubmit, user } = setup();
  await user.click(screen.getByRole('button', { name: /guardar/i }));
  expect(await screen.findByText(/nombre.*obligatorio/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('envía el payload limpio (trim) al guardar', async () => {
  const { onSubmit, user } = setup();
  await user.type(screen.getByLabelText(/nombre/i), '  Acme  ');
  await user.click(screen.getByRole('button', { name: /guardar/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Acme' }));
});

it('anti doble envío: dos clics seguidos = una sola llamada', async () => {
  let release;
  const onSubmit = vi.fn(() => new Promise((r) => (release = r)));
  const user = userEvent.setup();
  render(<SupplierModal isOpen onClose={() => {}} onSubmit={onSubmit} initialData={{ name: 'Acme' }} />);

  const save = screen.getByRole('button', { name: /guardar/i });
  await user.click(save);
  await user.click(save);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  release();
});

it('si onSubmit rechaza, muestra el error y el modal sigue abierto', async () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockRejectedValue(new Error('Ya existe un proveedor con ese nombre'));
  const user = userEvent.setup();
  render(<SupplierModal isOpen onClose={onClose} onSubmit={onSubmit} initialData={{ name: 'Acme' }} />);

  await user.click(screen.getByRole('button', { name: /guardar/i }));
  expect(await screen.findByText('Ya existe un proveedor con ese nombre')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it('al reabrir con otros datos se reinicia el formulario', () => {
  const { rerender } = render(<SupplierModal isOpen onClose={() => {}} onSubmit={() => {}} initialData={{ name: 'A' }} />);
  expect(screen.getByLabelText(/nombre/i)).toHaveValue('A');
  rerender(<SupplierModal isOpen onClose={() => {}} onSubmit={() => {}} initialData={{ name: 'B' }} />);
  expect(screen.getByLabelText(/nombre/i)).toHaveValue('B');
});
```

Ajusta los selectores a la UI real. **Ejemplo verificado:** `tests/components/UserModal.test.jsx` (12 pruebas del modal de usuarios). Ahí se consulta por `getByPlaceholderText` porque los `<label>` del proyecto **no están asociados** a sus campos (`getByLabelText` fallaría); si estrenas un formulario, añade `htmlFor`/`id` (o `aria-label`) y podrás consultar por etiqueta, que además mejora la accesibilidad. Cuidado con textos repetidos: el mismo mensaje puede estar en la ayuda fija y en el banner de error (`findByText` fallaría con "multiple elements"); usa `findAllByText` o acota con `within(...)`.

## Listado con tres estados

`renderAsAdmin` / `renderAsWorker` (de `tests/helpers/renderWithApp.jsx`) montan la pantalla con sesión iniciada (usuario **y** token en `sessionStorage`), `AuthProvider` y `MemoryRouter`. Para pantallas con varias peticiones usa `mockFetchRoutes({ 'GET /api/suppliers': jsonResponse([...]) })` en vez de `mockFetch` en orden.

```jsx
// tests/components/SuppliersPage.test.jsx
import { screen } from '@testing-library/react';
import { jsonResponse, mockFetch } from '../helpers/fetchMock';
import { renderAsAdmin } from '../helpers/renderWithApp'; // sesión + AuthProvider + MemoryRouter

it('lista los proveedores', async () => {
  mockFetch(jsonResponse([{ id: 1, name: 'Acme' }]));
  renderAsAdmin(<SuppliersPage />);
  expect(await screen.findByText('Acme')).toBeInTheDocument();
});

it('vacío: mensaje claro', async () => {
  mockFetch(jsonResponse([]));
  renderAsAdmin(<SuppliersPage />);
  expect(await screen.findByText(/no hay proveedores/i)).toBeInTheDocument();
});

it('error: tarjeta con Reintentar que recupera', async () => {
  const fetchMock = mockFetch(jsonResponse({}, 500), jsonResponse([{ id: 1, name: 'Acme' }]));
  const user = userEvent.setup();
  renderAsAdmin(<SuppliersPage />);

  await user.click(await screen.findByRole('button', { name: /reintentar/i }));
  expect(await screen.findByText('Acme')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
```

## Permisos por rol y 403 del servidor

```jsx
it('un trabajador no ve las acciones de admin', async () => {
  mockFetch(jsonResponse([{ id: 1, name: 'Acme' }]));
  renderAsWorker(<SuppliersPage />);
  await screen.findByText('Acme');
  expect(screen.queryByRole('button', { name: /nuevo proveedor/i })).not.toBeInTheDocument();
});

it('un 403 del servidor se muestra y no cierra la sesión', async () => {
  const fetchMock = mockFetch(jsonResponse({ error: 'No tienes permisos para realizar esta acción.' }, 403));
  // ... disparar la acción y verificar showErrorAlert con ese texto; sessionStorage conserva el token
});
```

Recuerda: **el servidor valida los roles** (matriz en `backend/tests/helpers/roleMatrix.ts`); esta prueba solo comprueba la interfaz. Si la pantalla ofrece una acción al trabajador, comprueba con `callOf(...)` que el cuerpo que envía es exactamente lo que esa ruta admite al WORKER (un campo de más da 403: pasó con `unitCost` en el ajuste de stock, ver `tests/components/StockAdjustmentModal.test.jsx`). Ver también `tests/components/auth.test.jsx` (rutas protegidas) y `ProductsPage.test.jsx` (`renderAsWorker`).

## Sesión: token y 401

```jsx
import { signInAs, TEST_TOKEN } from '../helpers/renderWithApp';

it('un 401 con token cierra la sesión y devuelve al login con aviso', async () => {
  // montar la app con renderWithApp, simular jsonResponse({ error: '...', code: 'TOKEN_EXPIRED' }, 401)
  // y comprobar: sessionStorage sin token/usuario y texto "Tu sesión expiró. Inicia sesión de nuevo."
});
```

Modelos completos: `tests/config/apiFetch.test.js` (401 una sola vez, 403, `skipAuth`, red caída) y `tests/components/auth.test.jsx` (`GET /api/auth/me` al montar, aviso en el login). Una sesión **sin token** no cuenta: guarda siempre usuario y token (`signInAs`).

## Confirmación antes de eliminar

```jsx
import * as alerts from '../../src/app/common/alertUtils';
vi.mock('../../src/app/common/alertUtils');

it('no elimina si el usuario cancela', async () => {
  alerts.confirmDialog.mockResolvedValue({ isConfirmed: false });
  const fetchMock = mockFetch(jsonResponse([{ id: 1, name: 'Acme' }]));
  // ... clic en "Eliminar"
  expect(alerts.confirmDialog).toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/suppliers/1'), expect.objectContaining({ method: 'DELETE' }));
});
```

## Fallos típicos y su causa

| Síntoma | Causa |
|---|---|
| `Unable to find role/label` | el texto cambió o el campo no tiene `<label>`; revisa con `screen.debug()` / `screen.logTestingPlaygroundURL()` |
| `act(...)` warning | un `await` faltante después de `userEvent`/`render`; usa `findBy*` |
| `useAuth must be used within an AuthProvider` | falta envolver con `<AuthProvider>` (y `MemoryRouter` si usa navegación): usa `renderWithApp` |
| La pantalla te manda a `/login` aunque "iniciaste sesión" | guardaste solo el usuario en `sessionStorage`; hace falta también el token (`signInAs(user)` guarda las dos claves) |
| `fetch sin simular: GET /api/...` (404 de `mockFetchRoutes`) | la pantalla pide una ruta que no declaraste en `mockFetchRoutes` |
| `project-structure.test.js` falla tras añadir un archivo | un service nuevo (o un `utils` con `formatCurrency`) hay que añadirlo a las listas de esa prueba; o llamaste a `fetch`/`sessionStorage` fuera de su sitio |
| `fetch is not defined` o llamadas reales | olvidaste `mockFetch`; `restoreMocks` + `setup.js` limpian entre pruebas, no dentro de una |
| La prueba pasa sola y falla en la suite | estado en `sessionStorage` o variable de módulo; `setup.js` limpia el storage, pero no variables de módulo |
| Fechas distintas según el PC | zona horaria/ICU; aserta con `toContain('2026')` o usa fechas a mediodía UTC |
