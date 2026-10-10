# Usuarios, autenticación y roles

Código: `backend/src/services/auth.service.ts`, `user.service.ts`, `utils/auth.utils.ts`; frontend `frontend/src/app/auth/` y `users/`.

## Contenido
- Modelo de seguridad actual (léelo primero)
- Contraseñas y usuario inicial
- Reglas de usuarios
- Qué restringe la UI por rol
- Cómo agregar una pantalla o acción con rol

## Modelo de seguridad actual (léelo primero)

- **El backend no autentica ni autoriza.** `POST /api/auth/login` solo devuelve los datos del usuario; no emite token ni cookie. Ningún endpoint verifica quién llama.
- El frontend guarda el usuario en `sessionStorage` (`masterfood_auth_user`) y decide permisos con `useAuth().isAdmin`, `ProtectedRoute` y condicionales en JSX.
- Consecuencia: cualquiera con acceso a la red puede llamar a la API directamente (listar usuarios, cambiar contraseñas con `PATCH /api/users/:id/password`, etc.). Es aceptable solo en una red local de confianza. Si la tarea requiere seguridad real (despliegue público), dilo al usuario: haría falta sesión/JWT en el servidor, middleware de rol y quitar `userId` del body.
- No existe `req.user`. No inventes un middleware de auth dentro de una tarea no relacionada: es un cambio transversal que debe pedirse explícitamente.

## Contraseñas y usuario inicial

- Regla: mínimo **6 caracteres** (`isValidPassword`: `trim().length >= 6`). Frontend: `isValidPassword6` (`users/utils/userUtils.js`) y validación en `LoginPage`.
- Hash: `crypto.scryptSync(password, salt, 64)`, guardado como `"<saltHex>:<hashHex>"`; verificación con `timingSafeEqual`.
- `init.ts` crea `Admin` / `123456` (rol `ADMIN`) si no existe ningún usuario con ese nombre. **Cámbiala tras el primer despliegue.**
- El nombre de usuario es **sensible a mayúsculas** (login usa `equals`; en SQLite `=` distingue mayúsculas). El placeholder del login dice "admin", pero el usuario sembrado es `Admin`.

## Reglas de usuarios

- Roles: `ADMIN` o `WORKER` (cualquier otro valor se normaliza a `WORKER`).
- Un usuario inactivo no puede iniciar sesión (403) aunque la contraseña sea correcta.
- **Último admin**: no se puede desactivar ni degradar al único `ADMIN` activo (`CANNOT_DEACTIVATE_LAST_ADMIN`).
- `username` único (comprobación en el service, no solo por índice).
- Los usuarios nunca se borran (no hay DELETE): se desactivan. Mantén ese criterio, porque la caja los referencia para auditoría.
- Las respuestas nunca incluyen `passwordHash` (usa siempre un `select` explícito).

## Qué restringe la UI por rol

| Área | Cualquier usuario | Solo admin |
|---|---|---|
| Dashboard | ver | - |
| Productos | ver, marcar disponible/agotado | crear, editar, eliminar, gestionar categorías |
| Comandas | crear, ver, eliminar | filtros de historial (turno/fecha/todas) |
| Inventario | ver, ajustar stock, ver Kardex, plantilla, exportar | crear/editar/eliminar insumos, importar Excel |
| Caja | abrir, cerrar, ver historial | editar sesiones, filtrar por empleado |
| Usuarios | - (ruta y menú ocultos) | todo |

## Cómo agregar una pantalla o acción con rol

- Ruta solo admin: `<ProtectedRoute adminOnly>...</ProtectedRoute>` en `router.jsx` **y** la entrada del `Sidebar` dentro de `...(isAdmin ? [...] : [])`.
- Acción solo admin dentro de una página: `const { isAdmin } = useAuth();` y renderiza el botón/modal solo si `isAdmin`; pasa `isAdmin` a los componentes hijos con default `true`/`false` explícito.
- Decide el rol con el usuario si el negocio no lo deja claro (patrones existentes: todos operan / todos leen y admin escribe / solo admin) y recuerda que es una restricción de interfaz, no de seguridad.
