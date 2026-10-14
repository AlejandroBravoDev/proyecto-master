/**
 * Matriz de roles ESPERADA de la API (S1), escrita a mano e independiente de la implementación.
 *
 * - `auth-route-guard.test.ts` exige que TODA ruta registrada en la app aparezca aquí (y que no
 *   sobren entradas): quien añada una ruta tiene que decidir su rol y declararlo.
 * - `auth-roles.test.ts` comprueba cada entrada contra el servidor con un WORKER y con un ADMIN.
 *
 * Clave de ruta: `MÉTODO /api/ruta` tal como se registra en Express (`:id`, `:productId`...).
 *
 *  - worker 'allow': un WORKER autenticado puede usarla (algunas con matices: ver `note`).
 *  - worker 'deny':  un WORKER recibe 403 siempre; solo ADMIN.
 *  - public: ruta sin token (solo el login).
 *  - workerBody: cuerpo VÁLIDO para el trabajador cuando la ruta solo le admite ciertos campos.
 */

export interface RoleRule {
  route: string;
  worker: 'allow' | 'deny';
  /** Ruta pública: no se prueba con token. */
  public?: true;
  /** Cuerpo con el que un WORKER sí puede llamarla (rutas con campos limitados). */
  workerBody?: Record<string, unknown>;
  note?: string;
}

export const ROLE_MATRIX: RoleRule[] = [
  // ---- Auth ----
  { route: 'POST /api/auth/login', worker: 'allow', public: true, note: 'única ruta pública' },
  { route: 'GET /api/auth/me', worker: 'allow' },

  // ---- Usuarios: solo ADMIN (incluye contraseñas y estado) ----
  { route: 'GET /api/users', worker: 'deny' },
  { route: 'GET /api/users/:id', worker: 'deny' },
  { route: 'POST /api/users', worker: 'deny' },
  { route: 'PUT /api/users/:id', worker: 'deny' },
  { route: 'PATCH /api/users/:id/password', worker: 'deny' },
  { route: 'PATCH /api/users/:id/status', worker: 'deny' },

  // ---- Categorías: leer todos; escribir solo ADMIN ----
  { route: 'GET /api/categories', worker: 'allow' },
  { route: 'GET /api/categories/:id', worker: 'allow' },
  { route: 'POST /api/categories', worker: 'deny' },
  { route: 'PUT /api/categories/:id', worker: 'deny' },
  { route: 'DELETE /api/categories/:id', worker: 'deny' },

  // ---- Productos: leer todos; el WORKER solo puede marcar disponible/agotado ----
  { route: 'GET /api/products', worker: 'allow' },
  { route: 'GET /api/products/:id', worker: 'allow' },
  { route: 'POST /api/products', worker: 'deny' },
  { route: 'PUT /api/products/:id', worker: 'allow', workerBody: { available: true }, note: 'WORKER: solo el campo `available`' },
  { route: 'DELETE /api/products/:id', worker: 'deny' },

  // ---- Insumos: leer/descargar todos; el WORKER solo puede ajustar stock ----
  { route: 'GET /api/ingredients', worker: 'allow' },
  { route: 'GET /api/ingredients/template/ingredients', worker: 'allow' },
  { route: 'GET /api/ingredients/export/ingredients', worker: 'allow' },
  { route: 'POST /api/ingredients/import/ingredients', worker: 'deny' },
  { route: 'GET /api/ingredients/:id', worker: 'allow' },
  { route: 'POST /api/ingredients', worker: 'deny' },
  {
    route: 'PUT /api/ingredients/:id',
    worker: 'allow',
    workerBody: { adjustStock: 1, adjustReason: 'MANUAL_ADJUSTMENT' },
    note: 'WORKER: solo `adjustStock` y `adjustReason`',
  },
  { route: 'DELETE /api/ingredients/:id', worker: 'deny' },

  // ---- Recetas: leer todos; escribir solo ADMIN ----
  { route: 'GET /api/recipes', worker: 'allow' },
  { route: 'GET /api/recipes/product/:productId', worker: 'allow' },
  { route: 'POST /api/recipes', worker: 'deny' },
  { route: 'DELETE /api/recipes/:id', worker: 'deny' },

  // ---- Comandas: todos, pero el WORKER solo las del turno actual ----
  { route: 'GET /api/orders', worker: 'allow', note: 'WORKER: solo turno actual (scope=all, date o sesión ajena -> 403)' },
  { route: 'GET /api/orders/:id', worker: 'allow', note: 'WORKER: solo comandas del turno actual' },
  { route: 'POST /api/orders', worker: 'allow' },
  { route: 'DELETE /api/orders/:id', worker: 'allow', note: 'WORKER: solo comandas del turno actual' },

  // ---- Ventas: solo ADMIN (la UI no las usa y exponen todo el historial) ----
  { route: 'GET /api/sales', worker: 'deny' },
  { route: 'GET /api/sales/:id', worker: 'deny' },
  { route: 'POST /api/sales', worker: 'deny' },

  // ---- Inventario (Kardex y alertas) y dashboard: lectura para todos ----
  { route: 'GET /api/inventory/movements', worker: 'allow' },
  { route: 'GET /api/inventory/alerts', worker: 'allow' },
  { route: 'GET /api/dashboard/kpis', worker: 'allow' },

  // ---- Caja: todos abren, cierran y consultan; editar sesiones solo ADMIN ----
  { route: 'GET /api/caja/status', worker: 'allow' },
  { route: 'POST /api/caja/open', worker: 'allow' },
  { route: 'POST /api/caja/close', worker: 'allow' },
  { route: 'PUT /api/caja/:id', worker: 'deny' },
  { route: 'GET /api/caja/history', worker: 'allow' },
  { route: 'GET /api/caja/session/:id', worker: 'allow' },
];

/** Sustituye los parámetros de ruta (`:id`, `:productId`) por un id válido que no existe. */
export function concretePath(pattern: string, id = 999999): string {
  return pattern.replace(/:[A-Za-z]+/g, String(id));
}
