/**
 * Extiende el tipo `Request` de Express con el usuario autenticado.
 * Lo rellena el middleware `authenticate` (middleware/auth.middleware.ts) a partir del usuario
 * leído de la BD en cada petición; nunca viene del cliente.
 */

export {};

declare global {
  namespace Express {
    /** Usuario autenticado de la petición actual. */
    interface AuthUser {
      id: number;
      username: string;
      fullName: string;
      role: 'ADMIN' | 'WORKER';
    }

    interface Request {
      /** Presente solo en las rutas montadas detrás de `authenticate`. */
      user?: AuthUser;
    }
  }
}
