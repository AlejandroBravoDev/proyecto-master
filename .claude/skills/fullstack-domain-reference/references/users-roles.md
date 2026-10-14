# Usuarios, autenticación y roles

Código: backend `middleware/auth.middleware.ts`, `utils/jwt.utils.ts`, `types/express.d.ts`, `services/auth.service.ts`, `user.service.ts`, `utils/auth.utils.ts`, `utils/username.utils.ts`; frontend `frontend/src/app/auth/` (`AuthContext`, `authStorage`, `ProtectedRoute`) y `users/`. Pruebas: `backend/tests/integration/auth-*.test.ts` y `frontend/tests/components/auth.test.jsx`.

## Contenido
- Modelo de seguridad (JWT + roles en el servidor)
- Matriz de roles por ruta
- Contraseñas y usuario inicial
- Reglas de usuarios
- Sesión y restricciones de la UI
- Cómo agregar una ruta o una pantalla con rol

## Modelo de seguridad (JWT + roles en el servidor)

- **Todo `/api` exige `Authorization: Bearer <token>`**, salvo `POST /api/auth/login`. `routes/index.ts` monta `/auth` primero (público) y después `router.use(authenticate)`: lo que se registre debajo queda protegido; una ruta inexistente de `/api` sin token responde 401. `/health`, el SPA estático y el preflight CORS son públicos.
- **Login**: `POST /api/auth/login` -> `{ user, token }`. Token JWT **HS256** (algoritmo fijado al firmar y al verificar) con claims `sub` (id), `role` (solo informativo), `pv` (huella corta del hash de la contraseña) y vigencia `JWT_EXPIRES_IN` (12 h por defecto). `GET /api/auth/me` devuelve `{ user }` fresco (el frontend lo usa para validar la sesión guardada).
- **`authenticate` relee al usuario de la BD en cada petición** y rellena `req.user = { id, username, fullName, role }` (tipo en `types/express.d.ts`). Consecuencias: desactivar a alguien -> 401 `USER_INACTIVE` inmediato; un cambio de rol aplica ya (el `role` del token no se cree); **cambiar la contraseña invalida los tokens anteriores** (`pv` ya no coincide -> 401 `INVALID_TOKEN`), incluida la propia sesión del admin que cambia la suya. No hay renovación ni logout de servidor.
- **Respuestas**: 401 `{ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.', code }` con `code` = `NO_TOKEN` · `INVALID_TOKEN` · `TOKEN_EXPIRED` · `USER_INACTIVE` y cabecera `WWW-Authenticate: Bearer`; 403 `{ error: 'No tienes permisos para realizar esta acción.' }`. Nunca se explica por qué falló la firma.
- **`JWT_SECRET`** (mínimo 32 caracteres) firma los tokens. Si falta se genera uno aleatorio por arranque, con aviso: las sesiones se pierden al reiniciar y no sirve con varias instancias. Si cambias el secreto, todas las sesiones abiertas se cierran. Variables y despliegue: `architecture.md` y `fullstack-release-deploy`.
- **Guardias de rol** (en `auth.middleware.ts`): `requireRole('ADMIN')` (403 al resto) y `requireAdminOrFields('campo', ...)` (el ADMIN pasa siempre; el resto solo si el cuerpo trae únicamente esos campos). Los módulos solo-ADMIN (`/users`, `/sales`) lo aplican en el montaje de `routes/index.ts`; los mixtos, ruta por ruta en su `*.routes.ts`. La caja usa `req.user.id` y **ignora** el `userId` del body.
- **Límite de tasa del login**: 10 intentos fallidos por IP cada 15 min (429). Riesgos que siguen abiertos (token en `sessionStorage`, límite solo por IP, recomendaciones sobre el WORKER): `known-issues.md`.

## Matriz de roles por ruta

WORKER = cualquier usuario autenticado salvo lo marcado. **La fuente de verdad ejecutable es `backend/tests/helpers/roleMatrix.ts`** (la prueba `auth-route-guard` exige que toda ruta registrada esté ahí y `auth-roles` la comprueba contra el servidor con un WORKER y un ADMIN): si este resumen y el archivo difieren, manda el archivo.

| Ruta | Rol |
|---|---|
| `POST /api/auth/login` | pública |
| `GET /api/auth/me` | autenticado |
| `GET/POST /api/users`, `GET/PUT /api/users/:id`, `PATCH /api/users/:id/password`, `PATCH /api/users/:id/status` | solo ADMIN |
| `GET /api/categories`, `/:id` | todos |
| `POST /api/categories`, `PUT/DELETE /api/categories/:id` | solo ADMIN |
| `GET /api/products`, `/:id` | todos |
| `POST /api/products`, `DELETE /api/products/:id` | solo ADMIN |
| `PUT /api/products/:id` | ADMIN cualquier campo; WORKER solo si el cuerpo trae únicamente `available` |
| `GET /api/ingredients`, `/:id`, `/template/ingredients`, `/export/ingredients` | todos |
| `POST /api/ingredients`, `DELETE /api/ingredients/:id`, `POST /api/ingredients/import/ingredients` | solo ADMIN |
| `PUT /api/ingredients/:id` | ADMIN cualquier campo; WORKER solo `adjustStock` y/o `adjustReason` |
| `GET /api/recipes`, `/product/:productId` | todos |
| `POST /api/recipes`, `DELETE /api/recipes/:id` | solo ADMIN |
| `POST /api/orders` | todos |
| `GET /api/orders` | todos; WORKER solo el turno actual: `scope=all`, cualquier `date` o un `cashSessionId` distinto de la caja abierta -> 403 |
| `GET/DELETE /api/orders/:id` | todos; WORKER solo si la comanda sigue activa (turno actual), si no 403 |
| `GET/POST /api/sales`, `GET /api/sales/:id` | solo ADMIN |
| `GET /api/inventory/movements`, `/alerts`, `GET /api/dashboard/kpis` | todos |
| `GET /api/caja/status`, `/history`, `/session/:id`, `POST /api/caja/open`, `/close` | todos |
| `PUT /api/caja/:id` | solo ADMIN |

## Contraseñas y usuario inicial

- Regla: mínimo **6 caracteres** (`isValidPassword`: `trim().length >= 6`). Frontend: `isValidPassword6` (`users/utils/userUtils.js`) y validación en `LoginPage`.
- Hash: `crypto.scryptSync(password, salt, 64)`, guardado como `"<saltHex>:<hashHex>"`; verificación con `timingSafeEqual`.
- **Usuario `Admin` inicial** (`init.ts`, paso "Sembrar Administrador"): se crea **solo si no existe** (comparación sin distinguir mayúsculas). Contraseña: `ADMIN_INITIAL_PASSWORD` (mín. 6) si está definida; si falta y `NODE_ENV=production`, una **aleatoria de 24 caracteres** que se imprime **una sola vez** en el log de arranque (guárdala); fuera de producción, `123456` (las pruebas dependen de ello). Un Admin que ya existe nunca se toca: el cambio de la variable no cambia su contraseña. Cambiar la contraseña después: Usuarios -> reasignar contraseña.
- El nombre de usuario **no distingue mayúsculas** en el login ni en la unicidad (`utils/username.utils.ts`, comparación en JS con `toLowerCase`/NFC): `admin`, `ADMIN` y `Admin` son el mismo usuario; se conserva la capitalización con la que se creó. El índice único de la BD (`users_username_key`) sí distingue mayúsculas (riesgo residual en `known-issues.md`, B9).

## Reglas de usuarios

- Roles: `ADMIN` o `WORKER` (cualquier otro valor se normaliza a `WORKER`).
- Un usuario inactivo no puede iniciar sesión (403 con la contraseña correcta) y sus tokens dejan de valer al instante (401 `USER_INACTIVE`).
- **Último admin**: no se puede desactivar ni degradar al único `ADMIN` activo (`CANNOT_DEACTIVATE_LAST_ADMIN`).
- `username` único sin distinguir mayúsculas (comprobación en el service). Alta y edición devuelven 400 si ya existe.
- Los usuarios nunca se borran (no hay DELETE): se desactivan. Mantén ese criterio, porque la caja los referencia para auditoría.
- Las respuestas nunca incluyen `passwordHash` (usa siempre un `select` explícito).
- `GET /api/users` pagina en el servidor si envías `page`/`limit` (`{ total, page, limit, totalPages, users }`; 15 por defecto, máx. 100); sin parámetros devuelve el array completo.

## Sesión y restricciones de la UI

- La sesión vive en `sessionStorage`, gestionada solo por `app/auth/authStorage.js`: token en `masterfood_auth_token`, usuario en `masterfood_auth_user`, y una copia del token en memoria si el almacenamiento falla. Una sesión con solo una de las dos claves no cuenta (se limpia). Cualquier módulo que necesite el token usa la capa HTTP (`config/apiFetch.js`: añade `Authorization` en cada petición); `tests/config/project-structure.test.js` prohíbe tocar `sessionStorage`, `Authorization` o el token fuera de `authStorage` / `apiFetch` / `AuthContext`.
- `AuthContext` valida la sesión guardada con `GET /api/auth/me` al montar (un 401 cierra la sesión; si el servidor no responde, la conserva) y expone `user`, `isAdmin`, `isAuthenticated`, `login`, `logout` y `sessionNotice`. Un **401** en cualquier petición con token limpia la sesión, avisa una sola vez y redirige a `/login` conservando la pantalla de origen, con el aviso "Tu sesión expiró. Inicia sesión de nuevo." (`USER_INACTIVE` muestra el texto del servidor). Un **403** no cierra la sesión: se muestra el mensaje del servidor.
- La UI **oculta** lo que el rol no puede hacer (el servidor lo rechazaría igualmente con 403):

| Área | Cualquier usuario | Solo admin |
|---|---|---|
| Dashboard | ver | - |
| Productos | ver, marcar disponible/agotado | crear, editar, eliminar, gestionar categorías |
| Comandas | crear, ver y eliminar las del turno actual | filtros de historial (turno/fecha/todas) |
| Inventario | ver, ajustar stock, ver Kardex, plantilla, exportar | crear/editar/eliminar insumos, importar Excel |
| Caja | abrir, cerrar, ver historial | editar sesiones, filtrar por empleado |
| Usuarios | - (ruta y menú ocultos) | todo |

Caso que ya mordió: la UI ofrece "ajustar stock" a todos, pero el modal enviaba `unitCost` y el servidor rechazaba el ajuste del WORKER con 403 (corregido: el modal solo envía el costo si el usuario es admin). Cuando cambies una acción de la UI, compara siempre el cuerpo que envía con lo que `roleMatrix.ts` admite para el WORKER.

## Cómo agregar una ruta o una pantalla con rol

**Backend (siempre, es lo que protege):**
1. Decide el rol con el usuario si el negocio no lo deja claro (patrones existentes: todos operan / todos leen y admin escribe / solo admin / el trabajador solo ciertos campos).
2. Una ruta nueva bajo `/api` queda protegida por `authenticate` automáticamente, pero **sin guardia de rol queda abierta a cualquier usuario autenticado**. Añade `requireRole('ADMIN')` (o `requireAdminOrFields(...)`) en el `*.routes.ts`, o en el montaje de `routes/index.ts` si todo el módulo es solo-ADMIN.
3. **Declara la ruta en `backend/tests/helpers/roleMatrix.ts`** (`route`, `worker: 'allow' | 'deny'`, `workerBody` si el trabajador solo admite ciertos campos). `auth-route-guard.test.ts` falla si una ruta registrada no está en la matriz (y si sobra una entrada); `auth-roles.test.ts` la prueba con un WORKER y un ADMIN.
4. Si el recurso tiene una regla por turno o por dueño (como las comandas del WORKER), valídala en el controller con `req.user` y responde con `sendForbidden(res)`.
5. Actualiza la tabla de arriba y `api-endpoints.md`.

**Frontend (comodidad, no seguridad):**
- Ruta solo admin: `<ProtectedRoute adminOnly>...</ProtectedRoute>` en `router.jsx` **y** la entrada del `Sidebar` dentro de `...(isAdmin ? [...] : [])`.
- Acción solo admin dentro de una página: `const { isAdmin } = useAuth();` y renderiza el botón/modal solo si `isAdmin`; pasa `isAdmin` a los componentes hijos con default `true`/`false` explícito.
- Un 403 del servidor llega como `Error` con el texto en español: muéstralo con `showErrorAlert`; no cierres la sesión.
