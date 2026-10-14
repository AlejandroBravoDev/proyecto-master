---
name: frontend-testing
description: Escribe y ejecuta pruebas automáticas del frontend React (Vitest + Testing Library + jsdom) - utilidades puras, services con fetch simulado y token de sesión, componentes, modales, páginas con rol, rutas protegidas, login y 401. Úsala SIEMPRE que se cree o cambie una utilidad, un service, un componente, un modal o una página del frontend, o cuando pidan "tests", "pruebas", "cobertura", "que no se rompa la UI" o reproducir un bug de pantalla con una prueba.
---

# Frontend: pruebas automáticas

Se prueba **lo que ve y hace el usuario** (texto, roles, clics), no detalles internos. El `fetch` se simula, así que estas pruebas no necesitan backend. El contrato real con el backend lo cubren `backend-testing` y el recorrido manual de `fullstack-verify-changes`. Guía y estado (2026-10-13: 17 archivos / 523 pruebas, todas en verde): `docs/testing.md`.

## Comandos (desde `frontend/`)

```bash
npm test                         # toda la suite (vitest run)
npx vitest run tests/services    # una carpeta o archivo
npx vitest run -t "valida"       # por nombre
npm run test:watch               # modo interactivo
npm run test:coverage            # cobertura de src/
```

## Qué hay montado

| Pieza | Para qué |
|---|---|
| `vitest.config.mjs` | entorno `jsdom`, plugin React, `restoreMocks`, `testTimeout` 20 s, incluye `tests/**/*.test.{js,jsx}` |
| `tests/setup.js` | matchers de `jest-dom`, `cleanup()`, espera de `findBy*` de 5 s y restablece `fetch`/`import.meta.env`/`sessionStorage`/`localStorage` tras cada prueba |
| `tests/helpers/fetchMock.js` | `mockFetch(...respuestas)` (en orden), `mockFetchRoutes({ 'GET /api/x': respuesta \| fn })` (por método y ruta; una ruta sin simular responde 404 con su nombre), `jsonResponse(body, status)` (incluye `clone()`: la capa HTTP lee una copia del cuerpo de un 401), `brokenJsonResponse(status)`, `blobResponse()`, `callOf(mock, n)` |
| `tests/helpers/renderWithApp.jsx` | `renderWithApp` / `renderAsAdmin` / `renderAsWorker` montan con **sesión iniciada** (usuario + token en `sessionStorage`), `AuthProvider` (con `validateOnMount={false}`) y `MemoryRouter`; `signInAs(user, token?)`, `TEST_TOKEN`, `ADMIN_USER`, `WORKER_USER` |
| `tests/{config,utils,services,components}/` | espejo de `src/`. **Fuera de `src/`** a propósito: el `preflight` marcaría los `fetch`/URLs de las pruebas como `FE-FETCH-OUTSIDE-SERVICE` / `FE-HARDCODED-URL` |
| `tests/config/project-structure.test.js` | **pruebas de estructura** sobre el código fuente (no hay otra prueba que las atrape): capa HTTP única (`fetch(` solo en `config/apiFetch.js`, `extractErrorMessage` definida una vez, cada service importa `config/apiFetch`), sesión (token, `sessionStorage` y `Authorization` solo en `authStorage` / `apiFetch` / `AuthContext`; `skipAuth` solo en el login; sin `window.open`/`XMLHttpRequest`), moneda única, sin `showToast` local ni `window.confirm`, animaciones definidas con `prefers-reduced-motion`, código muerto retirado |

> **Al añadir un `<feature>Service.js` o un `utils` con `formatCurrency`**, actualiza las listas exactas de `project-structure.test.js` (los 7 services actuales y los 5 `utils` que reexportan el formateador): la prueba falla a propósito para que lo decidas. Si tu código llama a `fetch(` directo, a `sessionStorage` o a `import.meta.env` fuera de su sitio, esa prueba también falla: corrige el código, no la prueba.

## Qué probar y cómo

| Tipo de archivo | Qué se prueba | Técnica |
|---|---|---|
| `utils/*.js` | entradas límite (`null`, `NaN`, vacío, negativos), redondeo, textos en español | `it.each`, sin DOM |
| `services/*.js` | URL exacta (`getApiBaseUrl()` + ruta), método, cuerpo JSON, query solo con filtros presentes, **cabecera `Authorization: Bearer <token>` cuando hay sesión** (`setStoredToken('...')` antes), mensaje de error en español (del backend o genérico con el código HTTP) y cuerpo no-JSON | `vi.stubEnv('VITE_API_URL', ...)` + `mockFetch` + `callOf` |
| capa HTTP (`apiFetch`) | token, `skipAuth`, 401 (cierra la sesión una vez y avisa al handler), 403 (no cierra sesión), error de red | `tests/config/apiFetch.test.js` es el modelo |
| componentes | lo que el usuario lee y puede hacer: renderiza, deshabilita, llama `onXxx` con los argumentos correctos | `render` + `screen.getByRole(...)` + `userEvent.setup()` |
| modales (`frontend-modal-form`) | se reinicia al abrir, validación (mensaje en el banner), `onSubmit` recibe el payload limpio (`null` para vaciar), **anti doble envío** (dos clics -> una llamada), error del servidor deja el modal abierto | `onSubmit` como `vi.fn()` que devuelve una promesa pendiente |
| páginas | los tres estados, el flujo con `mockFetchRoutes`, lo que ve cada rol (`renderAsWorker` oculta las acciones de admin) y **el cuerpo exacto que se envía** | `renderAsAdmin`/`renderAsWorker` + `mockFetchRoutes` + `vi.mock` de `alertUtils` |
| rutas / sesión | `ProtectedRoute adminOnly` redirige a un `WORKER`; sin sesión (o con usuario sin token) va a `/login`; un 401 lleva al login con el aviso de sesión expirada | `tests/components/auth.test.jsx` es el modelo |
| listados (`frontend-data-views`) | los tres estados cargando / error (con "Reintentar") / vacío, filtro y paginación | `mockFetch` con respuesta que resuelve tras `await screen.findBy...` |

## Reglas que evitan pruebas frágiles

- **Consulta por rol y texto** (`getByRole('button', { name: /Ingresar/ })`), no por clases de Tailwind ni por estructura DOM. Los textos de la UI están en español: úsalos.
- **Siempre `userEvent.setup()`** y `await` en cada acción. Usa `findBy*`/`waitFor` para lo asíncrono, nunca `setTimeout`.
- **Sesión sin pasar por el login**: usa `renderWithApp` (o `signInAs(user)` antes de montar tu propio `<AuthProvider>`). **Hacen falta las dos claves** de `sessionStorage` (`masterfood_auth_user` y `masterfood_auth_token`): con solo el usuario la sesión no cuenta (la app lo trata como sin sesión y va a `/login`). Con `renderWithApp` las peticiones salen con `Authorization: Bearer test-token`; `validateOnMount={false}` evita la llamada extra a `GET /api/auth/me` (se prueba aparte en `auth.test.jsx`).
- **Respuestas simuladas a mano**: si no usas `jsonResponse`, incluye `clone()` (la capa HTTP lee una copia del cuerpo de un 401) y `ok`/`status`.
- **SweetAlert2**: no lo dejes abrir diálogos reales en jsdom; mockea el módulo propio: `vi.mock('../../src/app/common/alertUtils', () => ({ showSuccessToast: vi.fn(), showErrorAlert: vi.fn(), confirmDialog: vi.fn() }))`. Para flujos con confirmación, `confirmDialog.mockResolvedValue({ isConfirmed: true })` y verifica que se llamó **antes** de eliminar.
- **Rutas con hash**: la app usa `createHashRouter`; en pruebas usa `MemoryRouter` con `initialEntries`, no el router real.
- **Fechas y monedas**: `Intl` depende de la versión de ICU; aserta con patrones (`/1\.299,50/`, `toContain('2026')`), no con cadenas largas de fecha.
- **Entorno**: `vi.stubEnv` para `import.meta.env`; `setup.js` lo restablece solo. `vi.stubGlobal('fetch', ...)` también.
- **Íconos y estilos**: `lucide-react` renderiza SVG normal; no necesita mocks. `css: false` ignora Tailwind.
- Si un componente usa un hook después de un `return null` (regla `FE-HOOK-AFTER-RETURN`), la prueba de abrir/cerrar el modal lo hará fallar: eso es lo que queremos detectar.
- **El servidor valida los roles; la prueba de pantalla solo prueba la interfaz**: que un WORKER no vea un botón no demuestra que la acción le funcione. Prueba también que lo que la pantalla envía a un WORKER es lo que `roleMatrix.ts` (backend) admite para ese rol.

## Receta para una pantalla o modal nuevo

1. Plantillas listas en `references/test-templates.md` (service, modal, listado con tres estados, rol).
2. Escribe primero las pruebas del **service** (URL, método, errores): son baratas y fijan el contrato con el backend. Añade el archivo a la lista de `project-structure.test.js` si es un service nuevo.
3. Después el **modal** o componente: validación, payload, doble envío, error del servidor.
4. Por último la **página**: estados cargando/error/vacío y permisos por rol (`renderAsAdmin` / `renderAsWorker`).
5. `npm test` + `fullstack-verify-changes` (preflight y recorrido en el navegador; las pruebas **no** sustituyen mirar la pantalla).

## Terminado cuando

- [ ] `npm test` en verde, sin `.only`/`.skip` olvidados ni `act(...)` warnings en la salida.
- [ ] Cada service nuevo prueba URL + método + cuerpo + un error con mensaje en español (y está en la lista de `project-structure.test.js`).
- [ ] Cada modal nuevo prueba validación, payload y anti doble envío.
- [ ] Ninguna prueba depende de un backend vivo ni de `localhost:3001` (la URL se fija con `vi.stubEnv`).
